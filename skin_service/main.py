"""
Skin Segmentation Inference Service
FastAPI server that loads the Swin Transformer model and provides segmentation API.
"""

# Import mmengine BEFORE torch when it exists so older checkpoint deserialization can find it.
# Keep it optional to allow preprocessing/unit tests to run in lightweight environments.
try:
    import mmengine  # noqa: F401
    import mmengine.logging  # noqa: F401
except ModuleNotFoundError:
    mmengine = None

import os
import io
import base64
import time
import numpy as np
import cv2
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
try:
    from fastapi import FastAPI, UploadFile, File, HTTPException, Header
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
except ModuleNotFoundError:
    class HTTPException(Exception):
        def __init__(self, status_code: int = 500, detail: str = ""):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    class _DummyApp:
        def __init__(self, *args, **kwargs):
            pass

        def add_middleware(self, *args, **kwargs):
            return None

        def get(self, *args, **kwargs):
            return lambda fn: fn

        def post(self, *args, **kwargs):
            return lambda fn: fn

        def on_event(self, *args, **kwargs):
            return lambda fn: fn

    class BaseModel:
        pass

    class UploadFile:
        content_type = "image/jpeg"
        filename = "upload.jpg"

        async def read(self):
            return b""

    def File(*args, **kwargs):
        return None

    def Header(default=None, *args, **kwargs):
        return default

    FastAPI = _DummyApp
    CORSMiddleware = object
from typing import Optional
try:
    import uvicorn
except ModuleNotFoundError:
    uvicorn = None
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("skin_service")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# SKIN_MODEL_PATH can override the default model path. The default stays inside the
# project so the demo can be moved between machines without depending on Desktop.
CKPT_PATH = os.environ.get(
    "SKIN_MODEL_PATH",
    os.path.join(PROJECT_ROOT, "best_mIoU_epoch_100.pth"),
)
ALLOWED_ORIGINS = [
    origin.strip() for origin in os.environ.get(
        "SKIN_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",") if origin.strip()
]
MAX_UPLOAD_BYTES = int(os.environ.get("SKIN_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
OPTIONAL_API_TOKEN = os.environ.get("SKIN_SERVICE_TOKEN", "").strip()

app = FastAPI(title="Skin Segmentation Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# ==============================================================
# Model definition (copied from test_model.py)
# ==============================================================
class ConvBNReLU(nn.Module):
    def __init__(self, in_ch, out_ch, kernel_size=3, padding=1):
        super().__init__()
        self.conv = nn.Conv2d(in_ch, out_ch, kernel_size, padding=padding, bias=False)
        self.bn = nn.BatchNorm2d(out_ch)

    def forward(self, x):
        return F.relu(self.bn(self.conv(x)))


class DepthwiseAggregationGate(nn.Module):
    def __init__(self, channels, reduction=16):
        super().__init__()
        hidden_channels = channels // reduction
        self.depthwise_conv = nn.Conv2d(channels, channels, 3, padding=1, groups=channels)
        self.pointwise_conv_1 = nn.Conv2d(channels, hidden_channels, 1)
        self.bn1 = nn.BatchNorm2d(hidden_channels)
        self.pointwise_conv_2 = nn.Conv2d(hidden_channels, channels, 1)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x):
        out = self.depthwise_conv(x)
        out = F.relu(self.bn1(self.pointwise_conv_1(out)))
        out = torch.sigmoid(self.bn2(self.pointwise_conv_2(out)))
        return x * out


class DABlock(nn.Module):
    def __init__(self, channels, num_heads=8, attn_drop=0.0, proj_drop=0.1, reduction=16):
        super().__init__()
        if channels % num_heads != 0:
            raise ValueError(f"channels={channels} must be divisible by num_heads={num_heads}")
        self.num_heads = num_heads
        self.head_dim = channels // num_heads
        self.scale = self.head_dim ** -0.5
        self.qkv = nn.Linear(channels, channels * 3)
        self.proj = nn.Linear(channels, channels)
        self.attn_drop = nn.Dropout(attn_drop)
        self.proj_drop = nn.Dropout(proj_drop)
        self.dag = DepthwiseAggregationGate(channels, reduction)

    def forward(self, x):
        b, c, h, w = x.shape
        tokens = x.flatten(2).transpose(1, 2)
        qkv = self.qkv(tokens).reshape(b, h * w, 3, self.num_heads, self.head_dim)
        qkv = qkv.permute(2, 0, 3, 1, 4)
        q, k, v = qkv[0], qkv[1], qkv[2]
        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = self.attn_drop(attn.softmax(dim=-1))
        out = (attn @ v).transpose(1, 2).reshape(b, h * w, c)
        out = self.proj_drop(self.proj(out)).transpose(1, 2).reshape(b, c, h, w)
        return x + out + self.dag(x)


class DABNeck(nn.Module):
    def __init__(self, in_channels=(96, 192, 384, 768), num_heads=8,
                 attn_drop=0.0, proj_drop=0.1, reduction=16):
        super().__init__()
        self.dabs = nn.ModuleList([
            DABlock(ch, num_heads=num_heads, attn_drop=attn_drop,
                    proj_drop=proj_drop, reduction=reduction)
            for ch in in_channels
        ])

    def forward(self, inputs):
        return [dab(x) for dab, x in zip(self.dabs, inputs)]


class DilatedBranch(nn.Module):
    def __init__(self, in_channels, out_channels, dilation_rates):
        super().__init__()
        self.convs = nn.ModuleList([
            nn.Conv2d(in_channels, out_channels, 3, padding=rate, dilation=rate)
            for rate in dilation_rates
        ])
        self.bn = nn.BatchNorm2d(out_channels * len(dilation_rates))

    def forward(self, x):
        out = torch.cat([conv(x) for conv in self.convs], dim=1)
        return F.relu(self.bn(out))


class ChannelAttention(nn.Module):
    def __init__(self, channels, reduction=16):
        super().__init__()
        hidden_channels = channels // reduction
        self.fc = nn.Sequential(
            nn.Conv2d(channels, hidden_channels, 1, bias=False),
            nn.ReLU(inplace=True),
            nn.Conv2d(hidden_channels, channels, 1, bias=False),
        )

    def forward(self, x):
        avg_out = self.fc(F.adaptive_avg_pool2d(x, 1))
        max_out = self.fc(F.adaptive_max_pool2d(x, 1))
        return torch.sigmoid(avg_out + max_out)


class SpatialAttention(nn.Module):
    def __init__(self, kernel_size=7):
        super().__init__()
        padding = kernel_size // 2
        self.conv = nn.Conv2d(2, 1, kernel_size, padding=padding, bias=False)

    def forward(self, x):
        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        return torch.sigmoid(self.conv(torch.cat([avg_out, max_out], dim=1)))


class CBAM(nn.Module):
    def __init__(self, channels, reduction=16):
        super().__init__()
        self.channel_attention = ChannelAttention(channels, reduction)
        self.spatial_attention = SpatialAttention()

    def forward(self, x):
        x = x * self.channel_attention(x)
        return x * self.spatial_attention(x)


class MultiScaleDilatedAttentionHead(nn.Module):
    def __init__(self, in_channels=96, channels=256, num_classes=2,
                 branch_configs=({"dilation_rates": (1,)},
                                 {"dilation_rates": (1, 2)},
                                 {"dilation_rates": (1, 2, 4)}),
                 dropout_ratio=0.1):
        super().__init__()
        self.conv_input = nn.Conv2d(in_channels, channels, 1)
        branch_out_channels = channels // 4
        self.branches = nn.ModuleList([
            DilatedBranch(channels, branch_out_channels, cfg["dilation_rates"])
            for cfg in branch_configs
        ])
        self.cbams = nn.ModuleList([
            CBAM(branch_out_channels * len(cfg["dilation_rates"]))
            for cfg in branch_configs
        ])
        fusion_in_channels = sum(branch_out_channels * len(cfg["dilation_rates"]) for cfg in branch_configs)
        self.fusion = nn.Sequential(
            nn.Conv2d(fusion_in_channels, channels, 1),
            nn.BatchNorm2d(channels),
            nn.ReLU(inplace=True),
        )
        self.residual = nn.Conv2d(channels, channels, 1)
        self.dropout = nn.Dropout2d(dropout_ratio) if dropout_ratio > 0 else nn.Identity()
        self.conv_seg = nn.Conv2d(channels, num_classes, 1)

    def forward(self, x):
        x = self.conv_input(x)
        branch_outs = [cbam(branch(x)) for branch, cbam in zip(self.branches, self.cbams)]
        out = self.fusion(torch.cat(branch_outs, dim=1)) + self.residual(x)
        out = F.relu(out)
        return self.conv_seg(self.dropout(out))


class SkinSegModel(nn.Module):
    def __init__(self):
        super().__init__()
        import timm
        self.backbone = timm.create_model(
            'swin_tiny_patch4_window7_224', pretrained=False,
            features_only=True, out_indices=(0, 1, 2, 3), img_size=256
        )
        self.stage_norms = nn.ModuleDict({
            '0': nn.LayerNorm(96), '1': nn.LayerNorm(192),
            '2': nn.LayerNorm(384), '3': nn.LayerNorm(768)
        })
        self.neck = DABNeck(in_channels=(96, 192, 384, 768), num_heads=8,
                            attn_drop=0.0, proj_drop=0.1, reduction=16)
        self.decode_head = MultiScaleDilatedAttentionHead(in_channels=96, channels=256,
                                                          num_classes=2, dropout_ratio=0.1)

    def forward(self, x):
        raw_outs = self.backbone(x)
        backbone_outs = []
        for i, o in enumerate(raw_outs):
            if o.dim() == 4 and o.shape[-1] in {96, 192, 384, 768}:
                o = o.permute(0, 3, 1, 2).contiguous()
            o = self.stage_norms[str(i)](o.permute(0, 2, 3, 1)).permute(0, 3, 1, 2).contiguous()
            backbone_outs.append(o)
        neck_outs = self.neck(backbone_outs)
        seg = self.decode_head(neck_outs[0])
        return F.interpolate(seg, x.shape[2:], mode='bilinear', align_corners=False)


# ==============================================================
# Key mapping
# ==============================================================
def map_ckpt_key(ckpt_key):
    k = ckpt_key
    if k.startswith('backbone.'):
        for i in range(4):
            k = k.replace(f'backbone.norm{i}.', f'stage_norms.{i}.')
        for i in range(4):
            k = k.replace(f'backbone.stages.{i}.blocks.', f'backbone.layers_{i}.blocks.')
        for i in range(4):
            k = k.replace(f'backbone.stages.{i}.downsample.', f'backbone.layers_{i+1}.downsample.')
        k = k.replace('backbone.patch_embed.projection.', 'backbone.patch_embed.proj.')
        k = k.replace('.attn.w_msa.', '.attn.')
        k = k.replace('.ffn.layers.0.0.', '.mlp.fc1.')
        k = k.replace('.ffn.layers.1.', '.mlp.fc2.')
    return k


def load_weights(model, ckpt_path):
    try:
        checkpoint = torch.load(ckpt_path, map_location='cpu', weights_only=True)
    except Exception as exc:
        if os.environ.get("SKIN_TRUST_CHECKPOINT") == "1":
            logger.warning("Falling back to weights_only=False for trusted local checkpoint: %s", exc)
            checkpoint = torch.load(ckpt_path, map_location='cpu', weights_only=False)
        else:
            raise RuntimeError(
                "模型权重无法以安全模式加载。若该 .pth 来源可信，请设置 SKIN_TRUST_CHECKPOINT=1 后重试。"
            ) from exc
    ckpt_sd = checkpoint.get('state_dict', checkpoint) if isinstance(checkpoint, dict) else checkpoint
    model_sd = model.state_dict()
    new_sd = dict(model_sd)
    loaded = 0
    for ckpt_key, ckpt_val in ckpt_sd.items():
        target = map_ckpt_key(ckpt_key)
        if target in model_sd and model_sd[target].shape == ckpt_val.shape:
            new_sd[target] = ckpt_val
            loaded += 1
    model.load_state_dict(new_sd, strict=False)
    return loaded, len(model_sd)


# ==============================================================
# Preprocessing
# ==============================================================
def preprocess(img: Image.Image) -> torch.Tensor:
    arr = np.array(img.resize((256, 256)).convert('RGB'), dtype=np.float32)
    mean = np.array([123.675, 116.28, 103.53], dtype=np.float32)
    std = np.array([58.395, 57.12, 57.375], dtype=np.float32)
    arr = (arr - mean) / std
    return torch.from_numpy(arr).permute(2, 0, 1).unsqueeze(0)


def build_valid_skin_roi(image: np.ndarray) -> np.ndarray:
    img = image.astype(np.uint8)
    if img.shape[:2] != (256, 256):
        img = cv2.resize(img, (256, 256), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    non_black = gray > 25
    saturation = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)[:, :, 1]
    skin_like = non_black & (saturation > 8)
    mask = skin_like.astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    if count > 1:
        largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        mask = (labels == largest).astype(np.uint8) * 255
    mask = cv2.erode(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)), iterations=1)
    return mask.astype(bool)


def detect_hair_mask(image: np.ndarray, valid_roi: np.ndarray) -> np.ndarray:
    img = image.astype(np.uint8)
    if img.shape[:2] != (256, 256):
        img = cv2.resize(img, (256, 256), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    hair = np.zeros(gray.shape, dtype=bool)
    for size in (17, 25):
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (size, size))
        blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)
        hair |= blackhat > 18
    hair &= valid_roi
    hair = cv2.morphologyEx(hair.astype(np.uint8) * 255, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)) > 0
    count, labels, stats, _ = cv2.connectedComponentsWithStats(hair.astype(np.uint8), 8)
    refined = np.zeros_like(hair)
    for label in range(1, count):
        x, y, w, h, area = stats[label]
        aspect = max(w, h) / max(1, min(w, h))
        if area <= 900 and aspect >= 5:
            refined[labels == label] = True
    return refined


def keep_plausible_components(pred: np.ndarray, probs: np.ndarray) -> np.ndarray:
    count, labels, stats, _ = cv2.connectedComponentsWithStats(pred.astype(np.uint8), 8)
    if count <= 1:
        return pred.astype(bool)
    areas = stats[1:, cv2.CC_STAT_AREA]
    largest_area = int(areas.max())
    min_area = max(180, int(largest_area * 0.08))
    refined = np.zeros_like(pred, dtype=bool)
    for label in range(1, count):
        component = labels == label
        area = int(stats[label, cv2.CC_STAT_AREA])
        mean_prob = float(probs[component].mean()) if area else 0.0
        x, y, w, h, _ = stats[label]
        aspect = max(w, h) / max(1, min(w, h))
        if area >= min_area and mean_prob >= 0.65 and aspect < 8:
            refined[component] = True
    return refined


def detect_prediction_line_artifacts(pred: np.ndarray, valid_roi: np.ndarray) -> np.ndarray:
    line_mask = np.zeros_like(pred, dtype=bool)

    def mark_thin_groups(indices, mark_group):
        if len(indices) == 0:
            return
        start = indices[0]
        prev = indices[0]
        for idx in indices[1:]:
            if idx == prev + 1:
                prev = idx
                continue
            if prev - start + 1 <= 8:
                mark_group(start, prev)
            start = prev = idx
        if prev - start + 1 <= 8:
            mark_group(start, prev)

    row_roi = valid_roi.sum(axis=1)
    row_ratio = np.divide(pred.sum(axis=1), row_roi, out=np.zeros(pred.shape[0], dtype=float), where=row_roi > 0)
    row_indices = np.where((row_ratio > 0.72) & (pred.sum(axis=1) > 80))[0]
    mark_thin_groups(row_indices, lambda start, end: line_mask.__setitem__((slice(start, end + 1), slice(None)), pred[start:end + 1, :]))

    col_roi = valid_roi.sum(axis=0)
    col_ratio = np.divide(pred.sum(axis=0), col_roi, out=np.zeros(pred.shape[1], dtype=float), where=col_roi > 0)
    col_indices = np.where((col_ratio > 0.72) & (pred.sum(axis=0) > 80))[0]
    mark_thin_groups(col_indices, lambda start, end: line_mask.__setitem__((slice(None), slice(start, end + 1)), pred[:, start:end + 1]))

    return line_mask & valid_roi


def postprocess_prediction(pred: np.ndarray, probs: np.ndarray, image: np.ndarray):
    refined = pred.astype(bool).copy()
    valid_roi = build_valid_skin_roi(image)
    refined &= valid_roi

    hair_mask = detect_hair_mask(image, valid_roi)
    removed_hair_pixels = int((refined & hair_mask).sum())
    refined &= ~hair_mask

    line_artifacts = detect_prediction_line_artifacts(refined, valid_roi)
    removed_hair_pixels += int(line_artifacts.sum())
    refined &= ~line_artifacts

    before_shape_cleanup = refined.copy()
    refined = cv2.morphologyEx(
        refined.astype(np.uint8) * 255,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)),
    ) > 0
    removed_hair_pixels += int((before_shape_cleanup & ~refined).sum())

    refined = keep_plausible_components(refined, probs)
    lesion_pixels = int(refined.sum())
    total_pixels = refined.size
    lesion_pct = lesion_pixels / total_pixels * 100
    lesion_conf = float(probs[refined].mean()) if lesion_pixels else 0.0
    is_low_risk = lesion_pixels == 0 or lesion_pct < 2.0 or (lesion_pct < 3.0 and lesion_conf < 0.7)
    if is_low_risk:
        refined[:] = False

    return refined, {
        "removed_hair_pixels": removed_hair_pixels,
        "is_low_risk": is_low_risk,
        "valid_roi_percentage": float(valid_roi.mean() * 100),
    }


# ==============================================================
# Global model
# ==============================================================
model: Optional[SkinSegModel] = None
model_metadata = {
    "model_path": CKPT_PATH,
    "model_exists": os.path.exists(CKPT_PATH),
    "loaded_weights": 0,
    "total_weights": 0,
    "load_ratio": 0.0,
}


@app.on_event("startup")
def load_model():
    global model, model_metadata
    logger.info(f"Loading model from {CKPT_PATH} on {DEVICE}...")
    if not os.path.exists(CKPT_PATH):
        logger.error(
            "\n" + "=" * 64 + "\n"
            "[skin-service] checkpoint NOT FOUND — 请先下载分割权重\n"
            "=" * 64 + "\n"
            f"期望路径: {CKPT_PATH}\n\n"
            "下载地址 (HuggingFace):\n"
            "  https://huggingface.co/lh527/qfhj/resolve/main/best_mIoU_epoch_100.pth\n"
            "  国内镜像: 将 huggingface.co 替换为 hf-mirror.com\n\n"
            "放置方式 (任选其一):\n"
            "  1) 下载后放至 <项目根>/best_mIoU_epoch_100.pth\n"
            "  2) 设置环境变量 SKIN_MODEL_PATH 指向权重文件\n\n"
            "详见项目 README.md「模型权重下载」章节。\n"
            "=" * 64
        )
        raise RuntimeError(f"Skin segmentation checkpoint not found: {CKPT_PATH}. "
                           f"Download best_mIoU_epoch_100.pth from "
                           f"https://huggingface.co/lh527/qfhj/resolve/main/best_mIoU_epoch_100.pth "
                           f"and place it at the project root, or set SKIN_MODEL_PATH.")
    model = SkinSegModel()
    loaded, total = load_weights(model, CKPT_PATH)
    load_ratio = loaded / total if total else 0.0
    model_metadata = {
        "model_path": CKPT_PATH,
        "model_exists": True,
        "loaded_weights": loaded,
        "total_weights": total,
        "load_ratio": round(load_ratio, 4),
    }
    if load_ratio < 0.95:
        raise RuntimeError(
            f"Skin checkpoint appears incompatible: loaded {loaded}/{total} weights ({load_ratio * 100:.1f}%). "
            "Please check SKIN_MODEL_PATH. Expected the epoch_100 checkpoint."
        )
    model.to(DEVICE).eval()
    logger.info(f"Model loaded: {loaded}/{total} weights ({load_ratio * 100:.1f}%)")


# ==============================================================
# Response model
# ==============================================================
class SegmentationResponse(BaseModel):
    success: bool
    lesion_percentage: float
    confidence_score: float
    mask_base64: str  # base64 encoded PNG mask
    overlay_base64: str  # base64 encoded overlay image
    lesion_area_pixels: int
    total_area_pixels: int
    inference_time_ms: float


# ==============================================================
# Endpoints
# ==============================================================
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None, **model_metadata}


@app.post("/segment", response_model=SegmentationResponse)
async def segment_image(file: UploadFile = File(...), authorization: Optional[str] = Header(default=None)):
    if OPTIONAL_API_TOKEN and authorization != f"Bearer {OPTIONAL_API_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image too large")
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="Only JPG, PNG and WEBP images are supported")
    try:
        img = Image.open(io.BytesIO(contents))
        img.verify()
        img = Image.open(io.BytesIO(contents)).convert('RGB')
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image")

    orig_w, orig_h = img.size

    # Preprocess
    tensor = preprocess(img).to(DEVICE)

    # Inference with brightness TTA for dark lesion sensitivity
    from PIL import ImageEnhance
    t0 = time.time()
    with torch.no_grad():
        output = model(tensor)
    softmax_out = F.softmax(output, dim=1)
    lesion_probs = softmax_out[0, 1].cpu().numpy()

    bright_img = ImageEnhance.Brightness(img).enhance(2.0)
    tensor_bright = preprocess(bright_img).to(DEVICE)
    with torch.no_grad():
        output_bright = model(tensor_bright)
    softmax_bright = F.softmax(output_bright, dim=1)
    lesion_probs_bright = softmax_bright[0, 1].cpu().numpy()

    lesion_probs = np.maximum(lesion_probs, lesion_probs_bright)
    t1 = time.time()
    inference_ms = (t1 - t0) * 1000

    # Use threshold 0.6 to reduce false positives on non-dermatoscopic images
    pred = lesion_probs > 0.6  # (256, 256)
    resized_img = np.array(img.resize((256, 256)).convert('RGB'))
    pred, post_stats = postprocess_prediction(pred, lesion_probs, resized_img)

    # Calculate lesion stats after ROI, hair and low-risk cleanup
    total_pixels = pred.size
    lesion_pixels = int(pred.sum())
    lesion_pct = lesion_pixels / total_pixels * 100

    # Confidence: average lesion probability ONLY over detected lesion pixels
    # (not over all pixels, which would be diluted by background)
    if lesion_pixels > 0:
        lesion_conf = float(lesion_probs[pred].mean())
    else:
        lesion_conf = 0.0

    # Generate mask image (colored)
    mask_img = np.zeros((*pred.shape, 3), dtype=np.uint8)
    mask_img[pred] = [220, 50, 50]  # Red for lesion
    mask_pil = Image.fromarray(mask_img).resize((orig_w, orig_h), Image.NEAREST)

    # Generate overlay image
    overlay_arr = np.array(img.resize((pred.shape[1], pred.shape[0])))
    overlay_arr_copy = overlay_arr.copy()
    overlay_arr_copy[pred] = (
        overlay_arr_copy[pred].astype(float) * 0.5
        + np.array([220, 50, 50], float) * 0.5
    ).astype(np.uint8)
    overlay_pil = Image.fromarray(overlay_arr_copy).resize((orig_w, orig_h))

    # Encode to base64
    mask_buf = io.BytesIO()
    mask_pil.save(mask_buf, format='PNG')
    mask_b64 = base64.b64encode(mask_buf.getvalue()).decode('utf-8')

    overlay_buf = io.BytesIO()
    overlay_pil.save(overlay_buf, format='PNG')
    overlay_b64 = base64.b64encode(overlay_buf.getvalue()).decode('utf-8')

    logger.info(
        f"Segmentation done: {inference_ms:.0f}ms, lesion={lesion_pct:.1f}%, "
        f"confidence={lesion_conf:.3f}, roi={post_stats['valid_roi_percentage']:.1f}%, "
        f"removed_hair={post_stats['removed_hair_pixels']}"
    )

    return SegmentationResponse(
        success=True,
        lesion_percentage=round(lesion_pct, 2),
        confidence_score=round(lesion_conf, 4),
        mask_base64=mask_b64,
        overlay_base64=overlay_b64,
        lesion_area_pixels=lesion_pixels,
        total_area_pixels=total_pixels,
        inference_time_ms=round(inference_ms, 1),
    )


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5000)

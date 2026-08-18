import argparse
import json
import os
import tempfile
import time
import zipfile
from pathlib import Path

import torch
import uvicorn
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer

app = FastAPI(title="QFHJ Local Fine-tuned Model", version="1.0")

MODEL = None
TOKENIZER = None
MODEL_DIR = None
MODEL_NAME = "traditional_medical"
LOCAL_MODEL_API_KEY = os.environ.get("LOCAL_MODEL_API_KEY", "").strip()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage]
    temperature: float | None = 0.6
    top_p: float | None = 0.95
    max_tokens: int | None = 512
    stream: bool | None = False


def safe_extract_zip(zip_obj: zipfile.ZipFile, target_dir: Path) -> None:
    target_root = target_dir.resolve()
    for member in zip_obj.infolist():
        member_path = (target_dir / member.filename).resolve()
        if target_root not in member_path.parents and member_path != target_root:
            raise RuntimeError(f"unsafe zip path detected: {member.filename}")
    zip_obj.extractall(target_dir)

def require_local_model_auth(authorization: str | None) -> None:
    if LOCAL_MODEL_API_KEY and authorization != f"Bearer {LOCAL_MODEL_API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")

MODEL_DOWNLOAD_GUIDE = """
================================================================
[local-model] model weights NOT FOUND — 请先下载微调模型权重
================================================================
期望目录: model2/  (缺少 config.json 或 model.safetensors)

下载地址 (HuggingFace):
  https://huggingface.co/lh527/qfhj/tree/main/model2
  国内镜像: 将 huggingface.co 替换为 hf-mirror.com

放置方式 (任选其一):
  1) 下载全部文件放入 <项目根>/model2/ 目录
  2) 设置环境变量 QFHJ_MODEL_DIR 指向已下载的模型目录
  3) 打包为 zip 后通过 --zip 参数或 QFHJ_MODEL_ZIP 提供

详见项目 README.md「模型权重下载」章节。
================================================================
"""


def validate_model_dir(model_dir: str | Path) -> str:
    model_dir = Path(model_dir)
    config = model_dir / "config.json"
    weights = model_dir / "model.safetensors"
    if not config.exists() or not weights.exists():
        print(MODEL_DOWNLOAD_GUIDE, flush=True)
        raise RuntimeError(f"model files are incomplete under {model_dir}. "
                           f"Download from https://huggingface.co/lh527/qfhj/tree/main/model2 and place under <project_root>/model2/, "
                           f"or point QFHJ_MODEL_DIR to an existing model directory.")
    return str(model_dir)


def prepare_model(zip_path: str | None = None, cache_dir: str | None = None, model_dir: str | None = None) -> str:
    if model_dir:
        return validate_model_dir(model_dir)

    root = Path(cache_dir) if cache_dir else Path(tempfile.gettempdir()) / "qfhj_model2_cache"
    cached_model_dir = root / "model2"
    if (cached_model_dir / "config.json").exists() and (cached_model_dir / "model.safetensors").exists():
        return str(cached_model_dir)

    if not zip_path:
        print(MODEL_DOWNLOAD_GUIDE, flush=True)
        raise FileNotFoundError("model directory is missing and no model zip was provided. "
                                "Download from https://huggingface.co/lh527/qfhj/tree/main/model2 "
                                "and place under <project_root>/model2/.")
    zp = Path(zip_path)
    if not zp.exists():
        raise FileNotFoundError(f"model zip not found: {zip_path}")

    root.mkdir(parents=True, exist_ok=True)
    print(f"[local-model] extracting {zp} to {root} ...", flush=True)
    with zipfile.ZipFile(zp, "r") as z:
        safe_extract_zip(z, root)
    return validate_model_dir(cached_model_dir)


def load_model(model_dir: str):
    global MODEL, TOKENIZER, MODEL_DIR
    MODEL_DIR = model_dir
    print(f"[local-model] loading tokenizer from {model_dir}", flush=True)
    TOKENIZER = AutoTokenizer.from_pretrained(model_dir, trust_remote_code=True)
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32
    print(f"[local-model] loading model dtype={dtype} cuda={torch.cuda.is_available()}", flush=True)
    MODEL = AutoModelForCausalLM.from_pretrained(
        model_dir,
        torch_dtype=dtype,
        device_map="auto" if torch.cuda.is_available() else None,
        trust_remote_code=True,
        low_cpu_mem_usage=True,
    )
    if not torch.cuda.is_available():
        MODEL.to("cpu")
    MODEL.eval()
    print("[local-model] ready on http://127.0.0.1:8000/v1", flush=True)


def messages_to_prompt(messages: list[ChatMessage]) -> str:
    # Use tokenizer chat template if available; otherwise use the LLaMAFactory/Ollama template from model2.
    msg = [{"role": m.role, "content": m.content} for m in messages]
    try:
        return TOKENIZER.apply_chat_template(msg, tokenize=False, add_generation_prompt=True)
    except Exception:
        system = "".join(m.content for m in messages if m.role == "system")
        prompt = "<｜begin▁of▁sentence｜>" + system
        for m in messages:
            if m.role == "user":
                prompt += "<｜User｜>" + m.content + "<｜Assistant｜>"
            elif m.role == "assistant":
                prompt += m.content + "<｜end▁of▁sentence｜>"
        return prompt


def generate_text(req: ChatRequest) -> str:
    if MODEL is None or TOKENIZER is None:
        raise RuntimeError("model is not loaded")
    prompt = messages_to_prompt(req.messages)
    inputs = TOKENIZER(prompt, return_tensors="pt")
    device = next(MODEL.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}
    max_new_tokens = max(1, min(int(req.max_tokens or 512), 2048))
    with torch.no_grad():
        out = MODEL.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=True,
            temperature=float(req.temperature or 0.6),
            top_p=float(req.top_p or 0.95),
            eos_token_id=TOKENIZER.eos_token_id,
            pad_token_id=TOKENIZER.eos_token_id,
        )
    new_tokens = out[0][inputs["input_ids"].shape[-1]:]
    text = TOKENIZER.decode(new_tokens, skip_special_tokens=True)
    return text.strip()

@app.get("/v1/models")
def models(authorization: str | None = Header(default=None)):
    require_local_model_auth(authorization)
    return {"object": "list", "data": [{"id": MODEL_NAME, "object": "model", "created": 0, "owned_by": "qfhj"}]}

@app.post("/v1/chat/completions")
def chat(req: ChatRequest, authorization: str | None = Header(default=None)):
    require_local_model_auth(authorization)
    try:
        text = generate_text(req)
        payload = {
            "id": "chatcmpl-qfhj-local",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": MODEL_NAME,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
        }
        if req.stream:
            def gen():
                yield "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(gen(), media_type="text/event-stream")
        return JSONResponse(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def root():
    return {"status": "ok", "model": MODEL_NAME, "model_dir": MODEL_DIR}

if __name__ == "__main__":
    project_root = Path(__file__).resolve().parent
    default_cache = project_root
    default_model_dir = project_root / "model2"
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default=os.environ.get("QFHJ_MODEL_DIR", str(default_model_dir)))
    parser.add_argument("--zip", default=os.environ.get("QFHJ_MODEL_ZIP", ""))
    parser.add_argument("--cache-dir", default=os.environ.get("QFHJ_MODEL_CACHE", str(default_cache)))
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    model_dir = prepare_model(args.zip or None, args.cache_dir, args.model_dir or None)
    load_model(model_dir)
    uvicorn.run(app, host=args.host, port=args.port)

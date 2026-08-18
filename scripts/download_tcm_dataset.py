# -*- coding: utf-8 -*-
"""
下载 HuggingFace 中医指令微调数据集（RAG 知识库语料）

数据集：SylvanL/Traditional-Chinese-Medicine-Dataset-SFT
  https://huggingface.co/datasets/SylvanL/Traditional-Chinese-Medicine-Dataset-SFT

默认下载 SFT_medicalKnowledge_source2 子集（99,334 条，与项目 RAG 知识库构建口径一致）。

用法：
  python scripts/download_tcm_dataset.py                    # 默认 source2 子集
  python scripts/download_tcm_dataset.py --subset SFT_medicalKnowledge_source2
  python scripts/download_tcm_dataset.py --list             # 列出全部子集文件

产物：data/tcm_sft/<subset>.json（后续由 import_rag_dataset.py 灌入）
依赖：pip install huggingface_hub
"""
import argparse
import sys
from pathlib import Path

REPO = "SylvanL/Traditional-Chinese-Medicine-Dataset-SFT"
OUT_DIR = Path("data/tcm_sft")


def list_files():
    from huggingface_hub import list_repo_files
    files = [f for f in list_repo_files(REPO, repo_type="dataset") if f.endswith(".json")]
    print(f"{REPO} 共 {len(files)} 个 JSON 子集：")
    for f in sorted(files):
        print(" ", f)
    return files


def download(subset: str):
    from huggingface_hub import hf_hub_download
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[..] 下载 {REPO}/{subset}")
    local = hf_hub_download(
        repo_id=REPO, repo_type="dataset", filename=subset,
        local_dir=OUT_DIR, local_dir_use_symlinks=False)
    print(f"[ok] 已保存: {local}")
    return local


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--subset", default="SFT_medicalKnowledge_source2_99334.json",
                    help="子集文件名（--list 查看），默认 medicalKnowledge source2（99,334 条）")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    try:
        from huggingface_hub import hf_hub_download, list_repo_files  # noqa: F401
    except ImportError:
        sys.exit("缺少依赖：pip install huggingface_hub\n国内网络可先：set HF_ENDPOINT=https://hf-mirror.com")

    if args.list:
        list_files()
        return
    download(args.subset)


if __name__ == "__main__":
    main()

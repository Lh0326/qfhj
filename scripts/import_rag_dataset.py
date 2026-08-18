# -*- coding: utf-8 -*-
"""
中医指令数据集 → RAG 知识库灌入脚本

管线（与项目报告描述对齐）：
  JSON 加载 → 字段解析（instruction/input/output 语义拼接）
  → MD5 去重（内容唯一标识）→ DashScope text-embedding-v4 批量向量化（1024 维）
  → 调后端 /api/v1/rag/document 批量灌入（自研 FLAT 索引持久化）

断点续传：已灌入条目的 MD5 记录于 data/tcm_sft/imported_md5.txt，重跑自动跳过。

用法（后端需已启动 :8081）：
  python scripts/import_rag_dataset.py --limit 10000       # 试跑 1 万条（验证成本）
  python scripts/import_rag_dataset.py                     # 全量 source2（99,334 条）
环境变量：
  DASHSCOPE_API_KEY   必填（DashScope/百炼 API Key，与后端 QWEN_API_KEY 同一把）
  QFHJ_BACKEND        默认 http://localhost:8081

成本参考：text-embedding-v4 约 0.0005 元/千 token。
  1 万条 ≈ 2~5 元 / 约 10 分钟；9.9 万条全量 ≈ 15~30 元 / 约 1 小时。
"""
import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("缺少依赖：pip install requests")

DEFAULT_INPUT = "data/tcm_sft/SFT_medicalKnowledge_source2_99334.json"
MD5_FILE = Path("data/tcm_sft/imported_md5.txt")
BATCH = 16                 # 每次 embedding 请求条数（DashScope 批量接口上限内）
WORKERS = 6                # 并发线程数（默认 6；撞限流可降到 3，或 --workers 1 回到串行）
EMBED_MODEL = "text-embedding-v4"
EMBED_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings"


def load_records(path: Path, limit: int):
    """兼容 HF 该数据集的两种形态：JSON 数组 / JSONL 每行一条"""
    records = []
    with open(path, encoding="utf-8") as f:
        head = f.read(4096)
        f.seek(0)
        if head.lstrip().startswith("["):
            data = json.load(f)
            for item in data:
                records.append(item)
        else:  # jsonl
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
    if limit > 0:
        records = records[:limit]
    return records


def to_knowledge_text(item: dict) -> str:
    """把问答对拼接为连贯知识段落（与报告预处理口径一致）"""
    instruction = (item.get("instruction") or "").strip()
    inp = (item.get("input") or "").strip()
    output = (item.get("output") or "").strip()
    parts = [p for p in (instruction, inp) if p]
    question = "。".join(parts) if parts else ""
    if question and output:
        return f"问：{question}\n答：{output}"
    return question or output


def md5_of(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def load_imported() -> set:
    if MD5_FILE.exists():
        return set(MD5_FILE.read_text(encoding="utf-8").split())
    return set()


def mark_imported(md5_list):
    MD5_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(MD5_FILE, "a", encoding="utf-8") as f:
        f.write("\n".join(md5_list) + "\n")


def embed_batch(texts, api_key):
    resp = requests.post(
        EMBED_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={"model": EMBED_MODEL, "input": texts},
        timeout=60)
    resp.raise_for_status()
    data = resp.json()["data"]
    return [d["embedding"] for d in data]


def ingest_to_backend(backend, texts, embeddings, api_key, token=None):
    """调后端 /rag/document 接口灌入（@RequestParam 表单参数 + JWT 认证；
    embedding 由后端侧生成并写入 FLAT 索引）。"""
    url = f"{backend}/api/v1/rag/document"
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    ok = 0
    for t in texts:
        r = requests.post(url, headers=headers,
                          data={"content": t, "title": "tcm_sft_source2"},
                          timeout=120)
        if r.status_code < 300:
            ok += 1
        else:
            print(f"[warn] 后端拒绝: {r.status_code} {r.text[:120]}")
            break   # 认证/服务故障时停止批次避免空转
    return ok


def main():
    global WORKERS
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default=DEFAULT_INPUT)
    ap.add_argument("--limit", type=int, default=0, help="只灌前 N 条（0=全量），试成本先 --limit 10000")
    ap.add_argument("--dry-run", action="store_true", help="只统计去重后条数与预估 token，不调 API")
    ap.add_argument("--workers", type=int, default=WORKERS, help="并发线程数（默认 6；限流严重用 3；1=串行兼容旧版）")
    args = ap.parse_args()
    WORKERS = args.workers

    api_key = os.environ.get("DASHSCOPE_API_KEY", "").strip()
    backend = os.environ.get("QFHJ_BACKEND", "http://localhost:8081")
    tok_path = Path("data/.admin_token")
    token = tok_path.read_text().strip() if tok_path.exists() else os.environ.get("QFHJ_TOKEN", "")
    if not token:
        sys.exit("缺少认证：先 admin 登录把 JWT 存到 data/.admin_token（或设 QFHJ_TOKEN 环境变量）——/rag/document 需登录")

    path = Path(args.input)
    if not path.exists():
        sys.exit(f"数据文件不存在：{path}\n请先运行 python scripts/download_tcm_dataset.py")

    print(f"[..] 加载 {path}")
    records = load_records(path, args.limit)
    print(f"[ok] 原始 {len(records)} 条")

    # 语义拼接 + MD5 去重
    seen = load_imported()
    docs, md5s = [], []
    dup = 0
    for item in records:
        text = to_knowledge_text(item)
        if not text or len(text) < 10:
            continue
        m = md5_of(text)
        if m in seen:
            dup += 1
            continue
        docs.append(text)
        md5s.append(m)
    print(f"[ok] 去重+跳过已导入后待灌 {len(docs)} 条（历史重复 {dup}）")

    total_chars = sum(len(d) for d in docs)
    est_tokens = int(total_chars * 0.6)   # 中文粗略 0.6 token/字
    print(f"[i] 预估 embedding 量 ~{est_tokens:,} tokens ≈ {est_tokens/1000*0.0005:.1f} 元")

    if args.dry_run:
        print("[dry-run] 结束（未调用任何 API）")
        return
    if not api_key:
        sys.exit("缺少 DASHSCOPE_API_KEY 环境变量（与后端 QWEN_API_KEY 同一把 Key）")

    t0 = time.time()
    done = err = 0
    try:
        if WORKERS <= 1:
            # 串行模式（兼容旧行为）
            for i in range(0, len(docs), BATCH):
                batch_docs = docs[i:i + BATCH]
                batch_md5 = md5s[i:i + BATCH]
                for attempt in range(3):
                    try:
                        ok = ingest_to_backend(backend, batch_docs, None, api_key, token)
                        done += ok
                        if ok == len(batch_docs):
                            mark_imported(batch_md5)
                        break
                    except Exception as e:
                        if attempt == 2:
                            err += len(batch_docs)
                            print(f"[warn] 批次失败跳过 @{i}: {e}")
                        else:
                            time.sleep(3)
                if (i // BATCH) % 10 == 0:
                    rate = done / max(1, time.time() - t0) * 60
                    print(f"[..] {i + len(batch_docs)}/{len(docs)}，成功 {done}，速度 ~{rate:.0f} 条/分")
        else:
            # 并发模式：WORKERS 个线程各自处理批次，锁保护断点文件写入
            import threading
            from concurrent.futures import ThreadPoolExecutor, as_completed
            lock = threading.Lock()
            counters = {"done": 0, "err": 0, "sent": 0}

            def worker(batch):
                docs_b, md5_b = batch
                for attempt in range(4):
                    try:
                        ok = ingest_to_backend(backend, docs_b, None, api_key, token)
                        with lock:
                            counters["done"] += ok
                            counters["sent"] += len(docs_b)
                            if ok == len(docs_b):
                                mark_imported(md5_b)
                        return ok == len(docs_b)
                    except Exception as e:
                        if attempt == 3:
                            with lock:
                                counters["err"] += len(docs_b)
                                counters["sent"] += len(docs_b)
                            print(f"[warn] 批次失败 @{md5_b[0][:6]}: {e}")
                            return False
                        time.sleep(2 ** attempt)   # 指数退避 1/2/4s

            batches = [(docs[i:i + BATCH], md5s[i:i + BATCH]) for i in range(0, len(docs), BATCH)]
            with ThreadPoolExecutor(max_workers=WORKERS) as pool:
                futures = [pool.submit(worker, b) for b in batches]
                for n, f in enumerate(as_completed(futures), 1):
                    f.result()
                    if n % 20 == 0:
                        rate = counters["done"] / max(1, time.time() - t0) * 60
                        pct = counters["sent"] / len(docs) * 100
                        eta = (len(docs) - counters["sent"]) / max(1, rate) if rate > 0 else 0
                        print(f"[..] 已发送 {counters['sent']}/{len(docs)} ({pct:.0f}%) | 成功 {counters['done']} | ~{rate:.0f} 条/分 | 预计剩 {eta/60:.1f} 分")
            done, err = counters["done"], counters["err"]
    except KeyboardInterrupt:
        print("\n[!] 手动中断——进度已记录，重跑自动续传")

    print(f"\n[done] 灌入 {done} 条 | 失败 {err} 条 | 耗时 {(time.time()-t0)/60:.1f} 分")
    print("[tip] 重跑本脚本将自动跳过已导入条目（MD5 断点在 data/tcm_sft/imported_md5.txt）")


if __name__ == "__main__":
    main()

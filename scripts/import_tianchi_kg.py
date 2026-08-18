# -*- coding: utf-8 -*-
"""
天池中药说明书实体数据集 → 嵌入式 Neo4j 知识图谱导入脚本

数据集：天池「中医药实体识别大赛」（中药药品说明书标注）
  https://tianchi.aliyun.com/competition/entrance/531824/information
  手动下载 JSON 后放置于 data/中药说明书实体识别数据集.json

数据模型（与后端 TcmKnowledgeGraphService 对齐）：
  (d:Drug {name})                          — 药品（中心节点）
  (e:TcmEntity {name, type, description})  — 各类实体（草药/功效/症状/证候…）
  (d)-[:HAS_INGREDIENT]->(e)               — 草药成分
  (d)-[:HAS_EFFICACY]->(e)                 — 中药功效
  (d)-[:TREATS_SYMPTOM]->(e)               — 治疗症状
  (d)-[:TREATS_DISEASE]->(e)               — 治疗疾病
  (d)-[:TREATS_SYNDROME]->(e)              — 治疗证候
  (d)-[:FOR_POPULATION]->(e)               — 适用/禁忌人群
  (d)-[:HAS_DOSAGE_FORM]->(e)              — 药物剂型
  (d)-[:HAS_FLAVOR_NATURE]->(e)            — 药物性味
  (d)-[:AVOID_FOOD]->(e)                   — 忌食食物
  (d)-[:AVOID_FOOD_GROUP]->(e)             — 忌食食物类
  实体间共现关系（同说明书内）：(e)-[:CO_OCCURS_WITH]->(e)

用法（先启动嵌入式 Neo4j）：
  python scripts/import_tianchi_kg.py                          # 全量导入
  python scripts/import_tianchi_kg.py --limit 100              # 只导前100份说明书
  python scripts/import_tianchi_kg.py --dry-run                # 只统计不写库
环境变量：
  NEO4J_URI       默认 bolt://localhost:17687（项目嵌入式端口）
  NEO4J_USERNAME  默认 neo4j
  NEO4J_PASSWORD  默认见 backend application.yml（与后端一致）
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    from neo4j import GraphDatabase
except ImportError:
    sys.exit("缺少 neo4j 驱动：pip install neo4j")

# 天池 13 类标签 → TcmEntity.type(中文展示) + 关系类型(英文，与后端 prettyRelation 对齐)
LABEL_REL_MAP = {
    "草药":       ("草药",   "HAS_INGREDIENT"),
    "中药功效":   ("中药功效", "HAS_EFFICACY"),
    "症状":       ("症状",   "TREATS_SYMPTOM"),
    "疾病":       ("疾病",   "TREATS_DISEASE"),
    "证候":       ("证候",   "TREATS_SYNDROME"),
    "人群":       ("人群",   "FOR_POPULATION"),
    "药物剂型":   ("药物剂型", "HAS_DOSAGE_FORM"),
    "药物性味":   ("药物性味", "HAS_FLAVOR_NATURE"),
    "食物":       ("食物",   "AVOID_FOOD"),
    "食物分组":   ("食物分组", "AVOID_FOOD_GROUP"),
}
# 分组类标签不单独建节点（与药品分组/疾病分组合并进父类语义）
SKIP_LABELS = {"药品分组", "疾病分组"}

BATCH_SIZE = 500          # 每 batch 提交的说明书份数
RETRY_MAX = 3


def connect_with_retry(uri, user, password, retries=5):
    for i in range(retries):
        try:
            driver = GraphDatabase.driver(uri, auth=(user, password),
                                          max_connection_lifetime=200)
            driver.verify_connectivity()
            print(f"[ok] Neo4j 连接成功: {uri}")
            return driver
        except Exception as e:
            print(f"[..] 连接失败 ({i + 1}/{retries}): {e}")
            time.sleep(3)
    sys.exit("无法连接 Neo4j，请先启动嵌入式实例：java -jar neo4j-embedded/target/qfhj-neo4j-embedded-1.0.0.jar neo4j-data 17687 17474")


def ensure_constraints(session):
    """与后端 ensureSchema 相同的唯一约束， MERGE 幂等导入的前提"""
    session.run("CREATE CONSTRAINT tcm_entity_name IF NOT EXISTS FOR (e:TcmEntity) REQUIRE e.name IS UNIQUE")
    session.run("CREATE CONSTRAINT drug_name IF NOT EXISTS FOR (d:Drug) REQUIRE d.name IS UNIQUE")
    print("[ok] 唯一约束已就绪（重复运行幂等）")


def import_document(tx, doc):
    """单份说明书导入：药品节点 + 实体节点 + 关系（一个事务内）"""
    anns = doc.get("annotations", [])
    # 主药品 = 第一处「药品」标注（说明书标题里的商品名）
    drug_name = next((a["entity"] for a in anns if a["label"] == "药品"), None)
    if not drug_name:
        return 0

    tx.run("MERGE (d:Drug {name: $name}) "
           "SET d.source = 'tianchi', d.updatedAt = datetime()", name=drug_name)

    rel_counts = 0
    created_entities = []
    for a in anns:
        label = a.get("label", "")
        entity = (a.get("entity") or "").strip()
        if not entity or label in SKIP_LABELS:
            continue
        if label == "药品" and entity == drug_name:
            continue
        mapping = LABEL_REL_MAP.get(label)
        if mapping is None:
            # 未映射标签（药品）作为实体节点但挂 CO_OCCURS_WITH
            if label == "药品":
                tx.run("MERGE (e:TcmEntity {name: $n}) "
                       "ON CREATE SET e.type = '药品', e.description = '药品 · 天池中药说明书数据集', e.updatedAt = datetime()",
                       n=entity)
                created_entities.append(entity)
                continue
            continue
        etype, rel = mapping
        tx.run(
            """
            MERGE (e:TcmEntity {name: $n})
            ON CREATE SET e.type = $t, e.description = $d, e.updatedAt = datetime()
            WITH e MATCH (d:Drug {name: $drug})
            MERGE (d)-[r:%s]->(e)
            """ % rel,
            n=entity, t=etype, d=f"{etype} · 天池中药说明书数据集", drug=drug_name)
        created_entities.append(entity)
        rel_counts += 1

    # 同说明书实体共现（草药↔功效等关联，供多跳查询）
    uniq = list(dict.fromkeys(created_entities))
    for i in range(len(uniq)):
        for j in range(i + 1, min(i + 6, len(uniq))):   # 限每实体最多5条共现防爆炸
            tx.run(
                "MATCH (a:TcmEntity {name: $x}), (b:TcmEntity {name: $y}) "
                "MERGE (a)-[r:CO_OCCURS_WITH]->(b)",
                x=uniq[i], y=uniq[j])
    return rel_counts


def main():
    ap = argparse.ArgumentParser(description="天池中药说明书数据集 → Neo4j")
    ap.add_argument("--file", default="data/中药说明书实体识别数据集.json")
    ap.add_argument("--limit", type=int, default=0, help="只导入前 N 份说明书（0=全量）")
    ap.add_argument("--dry-run", action="store_true", help="只统计，不写库")
    args = ap.parse_args()

    uri = os.environ.get("NEO4J_URI", "bolt://localhost:17687")
    user = os.environ.get("NEO4J_USERNAME", "neo4j")
    password = os.environ.get("NEO4J_PASSWORD", "neo4j-password")

    path = Path(args.file)
    if not path.exists():
        sys.exit(f"数据文件不存在：{path}\n请从天池竞赛页下载数据集后放置于该路径")

    data = json.load(open(path, encoding="utf-8"))
    if args.limit > 0:
        data = data[:args.limit]
    print(f"[ok] 加载 {len(data)} 份说明书")

    if args.dry_run:
        from collections import Counter
        c = Counter(a["label"] for d in data for a in d.get("annotations", []))
        drugs = sum(1 for d in data if any(a["label"] == "药品" for a in d.get("annotations", [])))
        print(f"[dry-run] 含主药品说明书: {drugs}")
        for k, v in c.most_common():
            print(f"  {k}: {v}")
        return

    driver = connect_with_retry(uri, user, password)
    t0 = time.time()
    total_rels = 0
    try:
        with driver.session(database="neo4j") as session:
            ensure_constraints(session)
            for i in range(0, len(data), BATCH_SIZE):
                batch = data[i:i + BATCH_SIZE]
                for doc in batch:
                    for attempt in range(RETRY_MAX):
                        try:
                            total_rels += session.execute_write(import_document, doc)
                            break
                        except Exception as e:
                            if attempt == RETRY_MAX - 1:
                                print(f"[warn] 跳过文档 {doc.get('id')}: {e}")
                            else:
                                time.sleep(1)
                done = min(i + BATCH_SIZE, len(data))
                print(f"[..] {done}/{len(data)} 文档，累计关系 {total_rels}，耗时 {time.time()-t0:.0f}s")
    finally:
        driver.close()

    # 汇总统计
    with GraphDatabase.driver(uri, auth=(user, password)).session(database="neo4j") as s:
        stats = s.run(
            "MATCH (d:Drug) WITH count(d) AS drugs "
            "OPTIONAL MATCH (:Drug)-[r]->(:TcmEntity) "
            "RETURN drugs, count(r) AS rels").single()
        ents = s.run("MATCH (e:TcmEntity) WHERE e.description CONTAINS '天池' RETURN count(e) AS n").single()["n"]
        print(f"\n[done] 药品 {stats['drugs']} 个 | 天池实体 {ents} 个 | 药物关系 {stats['rels']} 条 | 总耗时 {time.time()-t0:.0f}s")
        print("[tip] 后端图谱页搜索药品名（如「乌鸡白凤丸」）即可看到成分/功效/症状网络")


if __name__ == "__main__":
    main()

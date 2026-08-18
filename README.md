# 千方慧鉴 QFHJ — 中医辨证 LLM Agent 问诊系统

> **Smart TCM Diagnosis Agent** — 把不可靠的 LLM 输出，治理成可靠的中医辨证工程流程。
>
> 2026 中国大学生计算机设计大赛参赛作品 ｜ 前后端分离 + 六服务多进程架构 + 本地微调模型 + 云端大模型双层调用

![Java](https://img.shields.io/badge/Java-17-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.5-green)
![React](https://img.shields.io/badge/React-18-61DAFB)
![Python](https://img.shields.io/badge/Python-3.10-blue)
![LoRA](https://img.shields.io/badge/%E5%BE%AE%E8%B0%83-LoRA-purple)
![Swin](https://img.shields.io/badge/%E5%88%86%E5%89%B2-Swin--T%2BDABNeck-teal)

---

## 目录

- [项目定位](#项目定位)
- [我们要解决的问题](#我们要解决的问题)
- [系统架构](#系统架构)
- [核心设计 1：七步状态机工作流](#核心设计-1七步状态机工作流)
- [核心设计 2：双层模型调用链路](#核心设计-2双层模型调用链路)
- [核心设计 3：LLM 不可信假设与五层防线](#核心设计-3llm-不可信假设与五层防线)
- [核心设计 4：两阶段 LoRA 微调](#核心设计-4两阶段-lora-微调)
- [核心设计 5：皮肤病灶分割与多模态分析](#核心设计-5皮肤病灶分割与多模态分析)
- [核心设计 6：双引擎知识系统](#核心设计-6双引擎知识系统)
- [更多功能模块](#更多功能模块)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [模型权重下载](#模型权重下载)
- [目录结构](#目录结构)
- [Roadmap](#roadmap)
- [License](#license)

---

## 项目定位

中医辨证是一个**强依赖、多阶段**的诊断过程：症状采集 → 经络时辰关联 → 病程传变判断 → 综合辨证 → 合方 → 疗效反馈 → 多学派复核。任何一个环节的信息缺失或错误输出，都会污染下游所有结论。

本项目将这一过程建模为**七步状态机工作流 Agent**，并以"**LLM 输出不可信**"为第一性假设构建防御架构——大模型负责生成，工程系统负责验证、兜底与降级。最终目标不是"让 AI 看起来会看病"，而是**让每一步输出都可验证、可恢复、可降级，流程永不中断**。

```text
不可靠的 LLM 原始输出
        ↓  五层防线（清洗 → 解析 → 校验兜底 → 延迟治理 → 前端兜底）
可验证、可恢复的辨证流程 → 保守而完整的辨证报告
```

---

## 我们要解决的问题

### LLM 直接问诊的三个顽疾

**1. 输出格式不可控。** 本地 1.5B 微调模型在实际运行中会产出 `<think>` 思维链泄漏、BPE 残留 token（如 `Ċ`/`Ġ` 字符）、JSON 字段缺失与格式漂移——下游解析步骤频繁崩坏，一条坏输出会卡死整个问诊流程。

**2. 单点依赖让系统脆弱。** 云端大模型网络抖动、超时、限流都会直接中断服务；纯本地模型则质量不足。任何单点都是可用性风险。

**3. 医疗场景不容许"流程中断"。** 用户填了七步问卷到第五步，AI 挂了就前功尽弃——这在产品上是不可接受的。

> 我们的回答：**放弃持续调 prompt 硬抠稳定性，把"LLM 不可信"写进架构。** 每一步 AI 输出都视为不可信输入，经五层防线治理后才进入流程；AI 完全失效时，由规则引擎基于前序已采集数据生成保守结论，保障流程闭环。

---

## 系统架构

![System Architecture](docs/images/fig1_architecture.png)

六个独立服务进程，启动顺序与依赖关系如下（详见 [部署指南](docs/deployment.md)）：

| # | 服务 | 技术栈 | 端口 | 职责 |
|---|------|--------|------|------|
| 1 | 前端 | React 18 + TypeScript + Vite 6 + Tailwind | 5173 | 七大功能模块 SPA |
| 2 | 后端 | Spring Boot 3.2 (Java 17) + Spring Security/JWT + JPA + WebFlux | 8081 (`/api/v1`) | 业务编排、FSM 控制、AI 路由 |
| 3 | 本地模型服务 | Python + FastAPI + transformers | 8000 | 微调 1.5B 模型推理（OpenAI 兼容接口） |
| 4 | 嵌入式 Neo4j | neo4j-harness 5.26（进程内） | 17687 (bolt) | 知识图谱存储 |
| 5 | 皮肤分割服务 | Python + FastAPI + PyTorch + timm | 5000 | Swin-T 分割网络推理 |
| 6 | MariaDB | MariaDB 12.x / MySQL 8 兼容 | 3306 | 业务数据（23 张表） |

![Deployment Topology](docs/images/fig7_deployment.png)

---

## 核心设计 1：七步状态机工作流

![Seven-Step FSM](docs/images/fig2_seven_step_fsm.png)

将中医辨证拆解为**七个强依赖步骤**，每步独立落库、支持断点续传：

| 步骤 | 名称 | 输入 | 落库表 |
|------|------|------|--------|
| 1 | 症候程度评估 | 症状选择 + 5 级严重度量化 | `wizard_symptom_assessment` |
| 2 | 子午归经 | 症状发作时辰 ↔ 经络脏腑关联 | `wizard_meridian_collection` |
| 3 | 六经传变 | 症候持续时日与传变路径 | `wizard_duration_record` |
| 4 | AI 辨证分析 | 前三步全量证据 → 八纲/脏腑/经络/六经交叉辨证 | `wizard_ai_diagnosis` |
| 5 | 合病合方 | 主次病机、合方加减决策 | `wizard_combined_formula` |
| 6 | 疗效评估 | 服药反馈 → 病机变化再判断 | `wizard_followup` |
| 7 | 多流派会诊 | 伤寒/温病/脏腑/经络四学派交叉复核 | `wizard_consultation` |

**关键工程细节：**

- **强顺序约束在服务端强制执行**：跳步请求直接拒绝（`validateStep` 返回"请先完成前面的步骤"），前端 `maxReached` 门控只是第一道防线
- **断点续传**：会话主表 `wizard_diagnosis_session` 持久化 `currentStep`；`?resume=` 参数 + `stepN-data` 恢复端点，用户中途关闭页面后可从断点继续
- **逐步落库**：每步的输入与 AI 输出分别持久化到独立表（另含补充问询 `wizard_supplementary_inquiry`、操作日志 `wizard_operation_log`、症状字典 `wizard_symptom_dict` 等支撑表，共 10 余张 wizard 系列会话状态表），任一步失败不丢失前序数据，实现从症状采集到辨证报告的全流程闭环

**第 7 步：四流派会诊的单次调用合并。** 伤寒、温病、脏腑、经络四个学派如果串行调用 4 次 LLM，延迟与失败率会叠加。本系统将其合并为**单次结构化 prompt 多角色输出**——一个 prompt 内列出四学派各自输出"辨证、治法、方药"，再输出统一综合方案（以 `===最终综合方案===` 分隔标记切分），并保留 **human-in-the-loop 二次生成机制**：用户可指定主流派（`selectedSchool`）触发最终方案的重新生成，或一键重新会诊。

---

## 核心设计 2：双层模型调用链路

![Dual-Model Pipeline](docs/images/fig3_dual_pipeline.png)

**本地 1.5B 微调模型起草 + 云端 Qwen-plus 润色**的双层调用链路：

```text
用户问诊
   ↓
[Layer 1] 本地微调模型生成短草稿（≤160 tokens，低温度采样）
   ↓ 草稿清洗 + 可用性判定（think 标签剥离 / CJK 字数 / 长度门槛）
   ├── 通过 → 草稿注入云端 system prompt
   │           ↓
   │    [Layer 2] Qwen-plus 润色：低信任纠错，不自由发挥
   │           ↓
   └── 超时/不可用 → 自动降级，直走云端
                ↓
         最终回复（SSE 流式）
```

**设计原则：云端只做低信任纠错，不做自由发挥。** 润色系统提示词明确约定：

- 本地草稿是**低置信度参考**，不是结论
- 草稿与用户原始症状冲突时，**必须忽略或纠正草稿**
- 证据链、鉴别辨证、安全提示、通俗解释由云端**独立完成**

**延迟治理：** 本地草稿设置**硬超时**（`local-draft-timeout-ms`，代码默认 2500ms，可按部署硬件调整——长 prompt 的 prefill 耗时与硬件强相关，GPU 形态建议放宽）。草稿生成本身异步并行（`CompletableFuture.supplyAsync`），主线程只在超时窗口内等待，**超时后不取消、直接放弃草稿走云端**，保护流式首字延迟。

**三档 AI_MODE 适配不同硬件部署形态：**

| 模式 | 行为 | 适用场景 |
|------|------|----------|
| `cloud_first` | 完全云端，本地旁路 | 无 GPU 的轻量部署 |
| `local_draft_qwen_refine`（默认） | 双层链路 | 标准形态（GPU 或强 CPU） |
| `local_only` | 纯本地 + 规则引擎兜底 | 内网/离线环境 |

---

## 核心设计 3：LLM 不可信假设与五层防线

![Five-Layer Defense](docs/images/fig4_five_layer_defense.png)

这是本系统**最重要的架构决策**。针对本地微调模型的四类不可控输出（think 思维链泄漏、BPE 残留 token、JSON 字段缺失、格式漂移），不做无止境的 prompt 调优，而是构建纵深防御：

| 层 | 名称 | 做什么 | 关键实现 |
|----|------|--------|----------|
| L1 | 清洗 | 剥离 `<think>...</think>`、去除 BPE 残留（`Ċ`/`Ġ`/`▁`）、去代码围栏、长度截断 | `cleanLocalDraft` / `sanitizeAiText` |
| L2 | 结构化解析 | 从混合文本中提取 JSON、正则逐字段回退提取、容错解码 | `extractJsonObject` / `extractFromText` |
| L3 | 校验兜底 | 字段校验；**输出非法时由规则引擎基于前序已采集的症状/经络/病程数据生成保守完整的辨证结构**（兜底置信度 0.58，明确标注辅助筛查性质） | `buildRuleBasedDiagnosisFallback` |
| L4 | 延迟治理 | 本地草稿硬超时、异步并行、SSE 超时预算、指数退避重试 | `executeLocalDraft` / `chatWithHistoryFast` |
| L5 | 前端兜底 | 展示层二次清洗、失败占位文案、一键重新生成 | `cleanAiDisplayText` |

**规则引擎兜底**是流程闭环的最后保障：云端 AI 临时失败或返回乱码时，系统基于用户已填写的症状严重度、子午归经、六经病程做保守辨证推断（主证/兼证方向、四诊摘要、就医安全提示），**不把用户卡在报错界面**，并显式声明结论来自规则推断而非 AI。

**这一防御范式被两个新模型调用点复用：**

- **皮肤检测**（Qwen-VL 输出解析）：低风险分割结果短路不调多模态、输出与分割结果一致性校验、校验失败回退到分割一致性分析
- **RAG**（LLM 总结）：总结失败时降级为原始证据摘要返回，检索结果永远可用

新功能的失败模式天然被隔离在单步内——这是五层防线作为**架构模式**（而非单个函数）的价值。

---

## 核心设计 4：两阶段 LoRA 微调

![Two-Stage Fine-tuning](docs/images/fig6_finetune.png)

基于 **LLaMA Factory** 框架对 DeepSeek-R1-Distill-Qwen-1.5B 基座进行两阶段 LoRA 微调：

| 阶段 | 语料类型 | 目标 |
|------|----------|------|
| 一 | 古文-现代文对照语料 | 古籍语义解析、术语转译能力打底 |
| 二 | 中医专业问答语料 | 疾病/药材/方剂/针灸/食疗领域对齐，对齐辨证表达范式 |

训练完成后**将 LoRA adapter 合并为完整权重**导出（`model2/` 目录），推理侧无需 peft 依赖，直接由 `local_model_server.py` 加载服务化：

- **OpenAI 兼容接口**（`/v1/chat/completions`）——后端零改动切换本地/云端
- SSE 流式响应、chat template 优先 + 手动模板 fallback
- GPU float16 / CPU float32 自适应
- zip 安全解压（防路径穿越）、可选 Bearer 鉴权

---

## 核心设计 5：皮肤病灶分割与多模态分析

![Skin Segmentation Network](docs/images/fig5_skin_network.png)

复现基于**动态代理瓶颈（DABNeck）与多尺度空洞注意力（MSDAH）**的 Swin Transformer 皮肤病灶分割网络：

- **骨干**：Swin-T（timm，`features_only` 四尺度 96/192/384/768）
- **颈部**：`DABNeck` = `DABlock` × 4（每尺度一个），8 头注意力 + 深度可分门控，残差融合 `x + attn(x) + gate(x)`
- **解码头**：`MultiScaleDilatedAttentionHead`，三分支空洞卷积（dilation `[1]` / `[1,2]` / `[1,2,4]`）+ CBAM + 残差
- **训练损失**（复现设置）：`L = 1.0·CE + 3.0·Dice + 0.5·Boundary-region`（权重来自损失敏感性分析）

**推理服务与多模态闭环**：封装为 FastAPI 服务（`skin_service/main.py`，:5000），后端 `SkinDetectionController` 的完整链路为：

```text
上传皮肤图像 → Python 分割服务（mask + overlay base64 返回）
            → 分割结果 + 原图注入 Qwen-VL-plus 多模态分析
            → 中医辨证意见（血热/湿热等证型倾向 + 调护建议）
            → 西医鉴别意见（玫瑰糠疹/体癣等鉴别 + 就医建议）
            → 检测记录入库
```

分割后处理包含有效皮肤 ROI 检测、毛发掩码、细线伪影过滤等工程化处理，保证输出掩码的可视化质量。

---

## 核心设计 6：双引擎知识系统

**引擎一：嵌入式 Neo4j 知识图谱**

- 基于 `neo4j-harness` 的**进程内嵌入式**部署——免 Docker、免独立安装，一条命令拉起（bolt :17687）
- 从题库与天池中药知识图谱同步实体建图（题目节点 + 中药节点 + 多类关系中文映射）
- 前端 `TCMKnowledge` 页面内嵌图谱可视化（节点/关系/统计同屏）

**引擎二：自研轻量向量检索（RAG）**

- `VectorStoreService`：Java 进程内 `ConcurrentHashMap` + 手写余弦相似度 + FLAT 全量检索，零外部向量库依赖
- DashScope `text-embedding-v4`（1024 维）向量化，索引持久化到 `vector_index.dat`
- 检索管线：语义检索 Top-K → 拼 prompt → LLM 总结；总结失败降级为证据摘要
- 知识语料来自 HuggingFace 开源中医指令数据集（[SylvanL/Traditional-Chinese-Medicine-Dataset-SFT](https://huggingface.co/datasets/SylvanL/Traditional-Chinese-Medicine-Dataset-SFT)），支持文档上传分块入库、MD5 断点续传导入

两个引擎各自独立服务（图谱可视化 + 语义检索），共同构成知识支撑层；融合检索列为演进方向（见 Roadmap）。

---

## 更多功能模块

| 模块 | 说明 |
|------|------|
| **AI 智能问诊（自由对话）** | 多轮对话、历史会话持久化（`chat_conversations`/`chat_messages`）、SSE 流式输出 |
| **中医体质辨识** | 中华中医药学会《中医体质分类与判定》标准（ZYYXH/T157-2009），CCMQ 完整版 65 题，九种体质，ECharts 雷达图可视化 |
| **题库练习** | 700+ 道题、五大分类（基础理论/中药/方剂/经络/针灸），分类缓存与练习历史 |
| **用户体系** | JWT 认证、注册/登录/个人中心、邮箱验证码（SMTP）、忘记密码重置 |
| **辨证报告 PDF 导出** | 前端 base64 图表嵌入 + 免责声明 |
| **演示模式** | 应用启动自动登录演示账号（`admin` / `admin123`，见[快速开始](#快速开始)） |
| **国际化** | i18next 中英双语 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18, TypeScript, Vite 6, Tailwind CSS, React Router 7, i18next, ECharts |
| 后端 | Spring Boot 3.2.5 (Java 17), Spring Security + JWT, Spring Data JPA, WebFlux (WebClient), SpringDoc |
| AI / 模型 | LLaMA Factory (LoRA), DeepSeek-R1-Distill-Qwen-1.5B, DashScope (Qwen-plus / Qwen-VL-plus / text-embedding-v4), FastAPI, transformers, PyTorch, timm (Swin-T) |
| 数据 | MariaDB / MySQL (23 tables), 嵌入式 Neo4j (neo4j-harness 5.26), 自研 FLAT 向量索引 |
| 构建 | Maven (backend), npm (frontend) |

---

## 快速开始

> 演示账号：**`admin` / `admin123`**（预置演示数据账号，登录页已预填；也可自行注册新账号走邮箱验证流程）

### 前置条件

- JDK 17+、Node.js 18+、Python 3.10+（建议 CUDA 版 PyTorch 以启用 GPU 推理）
- MariaDB / MySQL 8 运行中
- DashScope API Key（云端润色与 embedding 用，[申请入口](https://dashscope.console.aliyun.com/)）

### 1. 数据库

```bash
mysql -u root -p < database/smarttcm_full.sql   # 导入 smarttcm 库（23 张表）
```

### 2. 模型权重

按 [模型权重下载](#模型权重下载) 章节放置两个权重文件（本地模型必需，皮肤检测可选）。

### 3. 启动六服务（按依赖顺序）

```bash
# ① 嵌入式 Neo4j（首次运行会初始化 neo4j-data/）
java -jar neo4j-embedded/target/qfhj-neo4j-embedded-1.0.0.jar neo4j-data 17687 17474

# ② 本地微调模型服务（OpenAI 兼容 :8000）
python local_model_server.py

# ③ 后端（:8081）—— DashScope key 通过环境变量注入
export QWEN_API_KEY=sk-xxxx   # Windows: set QWEN_API_KEY=sk-xxxx
cd backend && java -jar target/smarttcm-java-backend-1.0.0.jar

# ④ 前端（:5173）
cd frontend && npm install && npm run dev

# ⑤ 皮肤分割服务（可选，:5000）
# PyTorch >= 2.6 需要信任自有 checkpoint：
SKIN_TRUST_CHECKPOINT=1 python skin_service/main.py
```

### 4. 访问

浏览器打开 **http://localhost:5173** ——应用会自动登录演示账号进入首页。

> 完整部署细节（含各服务构建方法、环境变量清单、常见问题）见 [docs/deployment.md](docs/deployment.md)。

---

## 模型权重下载

两个权重文件体积较大，**不随仓库分发**，请从 HuggingFace 下载：

| 权重 | 大小 | 下载 | 放置路径 |
|------|------|------|----------|
| 微调模型（LoRA 合并完整权重） | ~3.5 GB | [lh527/qfhj · model2/](https://huggingface.co/lh527/qfhj/tree/main/model2) | `<项目根>/model2/`（目录内全部文件） |
| 皮肤分割 checkpoint | ~130 MB | [best_mIoU_epoch_100.pth](https://huggingface.co/lh527/qfhj/resolve/main/best_mIoU_epoch_100.pth) | `<项目根>/best_mIoU_epoch_100.pth` |

**国内加速**：将链接中的 `huggingface.co` 替换为 `hf-mirror.com` 即可走镜像。

```bash
# 方式一：huggingface-cli（推荐）
pip install -U huggingface_hub
huggingface-cli download lh527/qfhj best_mIoU_epoch_100.pth --local-dir .
huggingface-cli download lh527/qfhj --include "model2/*" --local-dir .

# 方式二：直接 wget（镜像示例）
wget https://hf-mirror.com/lh527/qfhj/resolve/main/best_mIoU_epoch_100.pth
```

**自定义路径**（不想放默认位置时）：

```bash
export QFHJ_MODEL_DIR=/path/to/model2      # 本地模型目录
export SKIN_MODEL_PATH=/path/to/xxx.pth    # 皮肤分割权重
```

未放置权重时启动服务会打印详细的下载引导信息，不影响其他服务运行。

---

## 目录结构

```text
qfhj/
├── backend/               # Spring Boot 后端 (Maven)
│   └── src/main/java/com/smarttcm/
│       ├── controller/    # WizardDiagnosis / Chat / SkinDetection / Rag / KnowledgeGraph ...
│       ├── service/       # DeepSeekService(双层路由) / WizardDiagnosisService(FSM) / RagService ...
│       └── entity/        # JPA 实体（wizard_* 表映射）
├── frontend/              # React + Vite 前端
│   └── src/app/pages/     # WizardDiagnosis / TCMDiagnosis / SkinDetection / TCMKnowledge ...
├── local_model_server.py  # 本地微调模型推理服务 (FastAPI, :8000)
├── skin_service/          # 皮肤分割推理服务 (FastAPI + timm, :5000)
├── neo4j-embedded/        # 嵌入式 Neo4j 启动器 (Maven)
├── scripts/               # 数据导入脚本（RAG 语料 / 天池图谱 / 数据集下载）
├── database/              # smarttcm_full.sql 建库脚本
└── docs/                  # 技术文档 + 架构图（images/）
```

**深入阅读**：[架构文档](docs/architecture.md) ｜ [功能特性](docs/features.md) ｜ [技术决策记录](docs/tech-decisions.md) ｜ [部署指南](docs/deployment.md)

---

## Roadmap

- [ ] 图谱-向量融合检索（GraphRAG 双通道证据增强）
- [ ] 重排序精排（reranker Top-K 精排）
- [ ] 医学 NER 实体抽取（增强图谱构建）
- [ ] vLLM / llama.cpp 推理后端（吞吐场景）
- [ ] Docker Compose 容器化一键部署
- [ ] 语音交互、处方 OCR

---

## License

[MIT](LICENSE) © 2026

---

> **免责声明**：本系统仅用于计算机设计大赛作品展示与学习交流，输出内容不构成医疗建议，不能替代执业医师诊断。

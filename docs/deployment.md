# 千方慧鉴 — 部署指南

> 本指南描述如何在本地环境完整部署千方慧鉴智慧中医健康管理平台。部署包含 5 个独立服务进程，请按顺序依次启动。

## 目录

- [环境依赖](#环境依赖)
- [大文件获取](#大文件获取)
- [数据库初始化](#数据库初始化)
- [服务启动](#服务启动)
- [环境变量配置](#环境变量配置)
- [AI 模式说明](#ai-模式说明)
- [验证清单](#验证清单)
- [常见问题](#常见问题)

---

## 环境依赖

| 依赖 | 版本要求 | 验证命令 | 用途 |
|------|----------|----------|------|
| JDK | 17 或 21 | `java -version` | 后端 Spring Boot 运行 |
| Maven | 3.8+ | `mvn -version` | 后端构建打包 |
| Node.js | 18+ | `node -version` | 前端开发服务器 |
| MySQL | 8.0+ | `mysql --version` | 业务数据存储 |
| Python | 3.10+ | `python --version` | 本地模型服务 + 皮肤分割服务 |
| pip | 最新版 | `pip --version` | Python 依赖安装 |
| npm | 9+ | `npm --version` | 前端依赖安装 |

**可选依赖：**

- CUDA 11.8+ / 12.x（NVIDIA 显卡）：本地模型推理加速
- 无显卡时自动使用 CPU 模式（首次加载约 1-2 分钟）

---

## 大文件获取

> 模型权重文件因体积较大未包含在代码仓库中，需从训练产物单独获取。

### 1. 本地微调模型（model2/）

DeepSeek-R1-Distill-Qwen-1.5B + LoRA 微调产物，用于中医问诊草稿生成。

**放置路径：** `qfhj/model2/`

**校验方式：** 确保目录下存在以下文件：
- `config.json` — 模型配置文件
- `model.safetensors` — 模型权重（约 3.4GB）
- 可选：`tokenizer.json`、`tokenizer_config.json` 等 tokenizer 文件

**PowerShell 校验脚本：**
```powershell
Test-Path "qfhj\model2\config.json"      # 应返回 True
Test-Path "qfhj\model2\model.safetensors" # 应返回 True
```

**获取方式：** 从训练环境或分发镜像中拷贝 `model2/` 目录到项目根目录。

---

### 2. 皮肤分割权重（best_mIoU_epoch_100.pth）

Swin Transformer + DABNeck + MSDAH 皮肤镜分割模型权重。

**放置路径：** `qfhj/best_mIoU_epoch_100.pth`（仓库根目录，即 `skin_service/` 的上一级；`skin_service/main.py` 按相对项目根解析，也可用环境变量 `SKIN_MODEL_PATH` 指定其他路径）

**校验方式：**
```powershell
Test-Path "qfhj\best_mIoU_epoch_100.pth" # 应返回 True
```

**获取方式：** 从训练产物中获取该 `.pth` 文件，放置于仓库根目录。

---

## 数据库初始化

### 1. 创建数据库

```sql
mysql -u root -p
CREATE DATABASE smarttcm DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> **MySQL root 无密码时：** 使用 `mysql -u root` 直接登录。

### 2. 导入完整数据

```sql
USE smarttcm;
SOURCE F:/study/计算机设计/2026019078-作品主文件夹/2026019078-02 素材与源码/code/qfhj/database/smarttcm_full.sql;
```

导入完成后应看到约 **844KB** 的数据导入成功，包含 24 张表。

---

## 服务启动

按以下顺序在 **5 个独立终端** 中启动服务。

### 终端 1 — Neo4j 嵌入式知识图谱（端口 17687）

```bash
cd F:/study/计算机设计/2026019078-作品主文件夹/2026019078-02 素材与源码/code/qfhj
java -jar neo4j-embedded/target/qfhj-neo4j-embedded-1.0.0.jar neo4j-data 17687 17474
```

**就绪标志：**
```
ready bolt=bolt://127.0.0.1:17687/
ready http=http://127.0.0.1:17474/
```

**常见故障：**
- 端口 17687 或 17474 已被占用 → 更改启动参数中的端口号
- JVM 内存不足 → 增加 `-Xmx2G` 参数

---

### 终端 2 — 本地微调模型服务（端口 8000）

```bash
cd F:/study/计算机设计/2026019078-作品主文件夹/2026019078-02 素材与源码/code/qfhj
python local_model_server.py
```

**就绪标志：**
```
ready on http://127.0.0.1:8000/v1
Model loaded: traditional_medical
```

**常见故障：**
- `model.safetensors` 不存在 → 检查 [大文件获取](#大文件获取) 步骤
- CUDA 错误（无显卡）→ 自动降级 CPU 模式，等待 1-2 分钟属正常
- `transformers` 或 `torch` 未安装 → `pip install transformers torch fastapi uvicorn`

---

### 终端 3 — 后端服务（端口 8081）

```bash
cd F:/study/计算机设计/2026019078-作品主文件夹/2026019078-02 素材与源码/code/qfhj/backend
java -jar target/smarttcm-java-backend-1.0.0.jar --spring.datasource.password=你的MySQL密码
```

> **MySQL root 无密码时：**
> ```bash
> java -jar target/smarttcm-java-backend-1.0.0.jar --spring.datasource.password=
> ```

**就绪标志：**
```
Started SmartTcmApiApplication in X.XX seconds
Tomcat started on port(s): 8081
```

**常见故障：**
- `Access denied for user 'root'` → 检查 MySQL 密码参数
- `SQLException: Database 'smarttcm' doesn't exist` → 执行 [数据库初始化](#数据库初始化)
- Neo4j 连接失败 → 确保终端 1 已启动

**构建命令（如 jar 不存在）：**
```bash
cd backend
mvn clean package -DskipTests
```

---

### 终端 4 — 前端开发服务器（端口 5173）

```bash
cd F:/study/计算机设计/2026019078-作品主文件夹/2026019078-02 素材与源码/code/qfhj/frontend
npm run dev
```

**首次运行前执行依赖安装：**
```bash
npm install
```

**就绪标志：**
```
  VITE v6.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**常见故障：**
- `Cannot find module` → 删除 `node_modules` 后重新 `npm install`
- 端口 5173 被占用 → 关闭占用进程或修改 `vite.config.ts` 中的 port

---

### 终端 5（可选）— 皮肤病分割服务（端口 5000）

```bash
cd F:/study/计算机设计/2026019078-作品主文件夹/2026019078-02 素材与源码/code/qfhj/skin_service
python main.py
```

**首次运行前执行依赖安装：**
```bash
pip install -r requirements.txt
```

**就绪标志：**
```
Uvicorn running on http://127.0.0.1:5000
Skin segmentation model loaded
```

**常见故障：**
- `WeightsUnpicklingError` → 设置环境变量 `SKIN_TRUST_CHECKPOINT=1`
- `timm` 或 `torch` 未安装 → `pip install timm torch fastapi uvicorn pillow`

---

## 环境变量配置

以下环境变量可通过命令行参数或系统环境变量设置，敏感值建议使用环境变量而非配置文件。

| 环境变量 | 说明 | 默认值（占位符） | 必填 |
|----------|------|------------------|------|
| `QWEN_API_KEY` | DashScope Qwen API 密钥 | `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | 是 |
| `QWEN_BASE_URL` | DashScope OpenAI 兼容端点 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 否 |
| `QWEN_MODEL` | 云端模型名称 | `qwen-plus` | 否 |
| `AI_MODE` | AI 模式（见 [AI 模式说明](#ai-模式说明)） | `local_draft_qwen_refine` | 否 |
| `LOCAL_DEEPSEEK_ENABLED` | 是否启用本地模型 | `true` | 否 |
| `LOCAL_DEEPSEEK_BASE_URL` | 本地模型服务地址 | `http://127.0.0.1:8000/v1` | 否 |
| `LOCAL_DEEPSEEK_MODEL` | 本地模型名称 | `traditional_medical` | 否 |
| `NEO4J_URI` | Neo4j 连接地址 | `bolt://localhost:17687` | 否 |
| `NEO4J_USERNAME` | Neo4j 用户名 | `neo4j` | 否 |
| `NEO4J_PASSWORD` | Neo4j 密码 | `neo4j-password` | 否 |
| `SPRING_DATASOURCE_URL` | MySQL 连接串 | `jdbc:mysql://localhost:3306/smarttcm?useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&useUnicode=true&characterEncoding=utf8` | 否 |
| `SPRING_DATASOURCE_USERNAME` | MySQL 用户名 | `root` | 否 |
| `SPRING_DATASOURCE_PASSWORD` | MySQL 密码 | `root` | 建议设置 |
| `JWT_SECRET` | JWT 签名密钥（≥32 字符） | `qfhj-smarttcm-jwt-secret-2026-default-key-32ch` | 生产环境必填 |
| `SKIN_SERVICE_URL` | 皮肤分割服务地址 | `http://127.0.0.1:5000` | 否 |
| `CORS_ALLOWED_ORIGINS` | CORS 允许来源 | `http://localhost:5173,http://127.0.0.1:5173` | 生产环境必填 |

**命令行参数示例：**
```bash
java -jar backend.jar \
  --spring.datasource.password=myPassword \
  --QWEN_API_KEY=sk-xxxxx \
  --AI_MODE=local_only
```

**环境变量设置（PowerShell）：**
```powershell
$env:QWEN_API_KEY="sk-xxxxx"
$env:SPRING_DATASOURCE_PASSWORD="myPassword"
```

---

## AI 模式说明

`AI_MODE` 环境变量控制中医问诊的 AI 调用策略，支持以下三种模式：

### 1. `cloud_first`（云端优先）

所有问诊请求直接使用云端 Qwen-plus 模型，不调用本地微调模型。

**优点：** 响应速度快，无需本地模型
**缺点：** 完全依赖网络，无本地化能力

---

### 2. `local_draft_qwen_refine`（默认）

**双层协同模式：** 本地微调模型生成草稿 → 云端 Qwen 润色纠错

流程：
1. 本地 DeepSeek-R1-Distill-Qwen-1.5B（LoRA 中医微调）生成短草稿（≈160 tokens）
2. 草稿清洗：去除 `

` 标签、BPE 残留字符
3. 云端 Qwen-plus 低信任润色/纠错/补充
4. 本地超时（2500ms）或不可用时，自动降级直走 Qwen

**优点：** 兼顾本地化专业能力与云端通用能力
**缺点：** 需要本地模型服务运行

---

### 3. `local_only`（纯本地模式）

所有问诊请求仅使用本地微调模型，不调用云端 API。

**优点：** 完全离线，数据不出本地
**缺点：** 输出质量依赖本地模型能力

---

## 验证清单

### 服务健康检查

| 服务 | 健康检查端点/方式 | 预期结果 |
|------|------------------|----------|
| 前端 | 访问 http://localhost:5173 | 加载登录页面 |
| 后端 | http://localhost:8081/api/v1/actuator/health | `{"status":"UP"}` |
| 本地模型 | http://127.0.0.1:8000/v1/models | 返回 `traditional_medical` 模型信息 |
| 皮肤服务 | http://127.0.0.1:5000/docs | FastAPI 文档页面 |
| Neo4j | http://127.0.0.1:17474 | Neo4j Browser 可访问 |

### 功能测试

1. **用户登录：**
   - 测试账号：`admin`
   - 测试密码：`admin123`
   - 预期：登录成功，进入仪表盘

2. **AI 智能问诊：**
   - 输入问题："我最近总是感觉疲劳，是什么原因？"
   - 预期：返回中医辨证分析（流式输出）

3. **向导式辨证：**
   - 进入"向导式辨证"模块，完成 7 步问诊
   - 预期：生成完整辨证报告 + PDF 导出

4. **体质辨识：**
   - 完成 65 题体质量表
   - 预期：显示九种体质雷达图

5. **知识图谱：**
   - 进入"知识图谱"模块
   - 预期：显示中药关系网络可视化

---

## 常见问题

### Q1：端口冲突

**症状：** 启动时报 `Address already in use: 8081` / `5173` / `5000`

**解决：**
- Windows 查找占用进程：
  ```powershell
  netstat -ano | findstr :8081
  taskkill /PID <进程ID> /F
  ```
- 或修改服务端口（后端在 `application.yml` 中 `server.port`，前端在 `vite.config.ts`）

---

### Q2：MySQL root 无密码登录

**症状：** `Access denied for user 'root'@'localhost'`

**解决：**
- 确认 MySQL 密码后，使用命令行参数：
  ```bash
  java -jar backend.jar --spring.datasource.password=实际密码
  ```
- 或设置环境变量：
  ```powershell
  $env:SPRING_DATASOURCE_PASSWORD=""
  ```

---

### Q3：CPU 模式下本地模型加载缓慢

**症状：** 终端 2 启动后卡住，无 `ready` 日志

**说明：** CPU 模式加载 3.4GB 权重约需 1-2 分钟，属正常现象。

**加速建议：**
- 使用 NVIDIA 显卡自动启用 CUDA 加速
- 首次加载后权重会缓存到内存，后续请求变快

---

### Q4：Neo4j 端口占用

**症状：** 终端 1 启动报 `Address already in use: 17687`

**解决：**
- 更换启动端口号：
  ```bash
  java -jar neo4j-embedded-1.0.0.jar neo4j-data 17688 17475
  ```
- 同步修改后端配置：
  ```bash
  java -jar backend.jar --spring.neo4j.uri=bolt://localhost:17688
  ```

---

### Q5：皮肤模型加载报 `WeightsUnpicklingError`

**症状：** PyTorch ≥ 2.6 的安全限制导致模型加载失败

**解决：** 设置环境变量后重启终端 5：
```powershell
$env:SKIN_TRUST_CHECKPOINT="1"
python main.py
```

---

### Q6：邮件发送失败

**说明：** 本地演示模式已跳过邮件验证，注册时可输入任意邮箱和任意 6 位数字验证码。

**生产环境配置：** 修改 `application.yml` 中的 `spring.mail` 配置段。

---

## 知识库数据集配置（可选，推荐）

系统的双引擎知识系统可灌入两个真实中医数据集。**不灌入系统也能运行**（RAG 支持前端手动上传文档、图谱自动同步题库），灌入后知识覆盖面大幅提升。

### 数据集 A：天池中药说明书 → Neo4j 知识图谱

**数据获取**（需天池账号，手动一次性操作）：

1. 访问 [天池中医药实体识别大赛](https://tianchi.aliyun.com/competition/entrance/531824/information)
2. 登录并报名竞赛后，在赛题数据页下载数据集 JSON（约 10MB，含 1,997 份药品说明书/59,803 条实体标注）
3. 将下载的 JSON 放置为 `data/中药说明书实体识别数据集.json`

**导入**（嵌入式 Neo4j 已启动的前提下）：

```bash
pip install neo4j
python scripts/import_tianchi_kg.py --dry-run   # 先预览标签分布
python scripts/import_tianchi_kg.py             # 全量导入（约 1-2 分钟）
python scripts/import_tianchi_kg.py --limit 100 # 或先试 100 份
```

导入脚本幂等（唯一约束 + MERGE，重复运行不会产生重复数据），Neo4j 连接参数可用环境变量 `NEO4J_URI`/`NEO4J_USERNAME`/`NEO4J_PASSWORD` 覆盖，默认与本项目嵌入式实例一致（`bolt://localhost:17687`）。

完成后在前端「知识图谱」页搜索任意药品名（如 **乌鸡白凤丸、益母草颗粒**）即可看到成分/功效/症状/禁忌网络。

### 数据集 B：HuggingFace 中医指令数据集 → RAG 向量知识库

**数据获取**（脚本自动下载，无需手动操作）：

```bash
pip install huggingface_hub
python scripts/download_tcm_dataset.py                 # 默认 source2 子集（99,334 条）
# 国内网络较慢时先切换镜像：
set HF_ENDPOINT=https://hf-mirror.com
```

**灌入**（后端已启动 :8081，且 DashScope API Key 有效）：

```bash
# 第一步：配置 Key（与后端 QWEN_API_KEY 是同一把 Key）
set DASHSCOPE_API_KEY=sk-你的key

# 第二步：先试 1 万条，验证成本与速度（约 2~5 元 / 10 分钟）
python scripts/import_rag_dataset.py --limit 10000

# 第三步：确认没问题后全量（约 15~30 元 / 1 小时）
python scripts/import_rag_dataset.py
```

**费用说明**：text-embedding-v4 按 token 计费（约 0.0005 元/千 token），费用只在**运行本脚本时**产生；灌入后检索不再产生 embedding 费用（仅检索词本身）。中断后重跑自动断点续传（MD5 记录于 `data/tcm_sft/imported_md5.txt`）。

### 灌入后的内存建议

9.9 万条 × 1024 维向量 ≈ 400MB 常驻 JVM 堆。全量灌入后建议后端启动参数加大堆：

```bash
java -Xmx2g -jar target/smarttcm-java-backend-1.0.0.jar
```

---

## Roadmap

以下功能已在技术规划中，当前版本暂未实现：

- [ ] 容器化部署（Docker Compose）
- [ ] Nginx 反向代理 + 负载均衡
- [ ] bge-reranker 重排序精排
- [ ] NER 实体抽取
- [ ] 语音交互
- [ ] 处方 OCR 识别

---

## 技术支持

如遇到本文档未覆盖的问题，请检查：

1. 各终端日志输出中的 `ERROR` 关键字
2. 浏览器开发者工具 Console 中的红色错误
3. 确保所有 5 个服务均已启动且处于 `ready` 状态

---

**部署完成后访问：** http://localhost:5173

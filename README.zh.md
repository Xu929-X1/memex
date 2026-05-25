# Memex

[English](./README.md)

```text
"设想未来有这样一种装置——个人可以用它存储所有的书籍、记录和通信，
并且可以以极快的速度、极灵活的方式进行检索。
它是人类记忆的一种扩展性的亲密补充。"

— Vannevar Bush
```

个人知识引擎。导入你的文档，语义化索引，用自然语言检索一切。

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 框架 | Next.js 16（App Router） |
| 数据库 | PostgreSQL via Supabase + pgvector（HNSW 索引） |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| LLM | OpenAI (GPT-4o) / Anthropic (Claude 3.5) via LangChain |
| 向量嵌入 | OpenAI `text-embedding-3-small`（1536 维，用于 chat RAG）+ 本地 `bge-small-en-v1.5`（384 维，用于相似度功能），通过 `@xenova/transformers` |
| PDF 解析 | [docling](https://github.com/DS4SD/docling) Python 边车（FastAPI，容器化） |
| 认证 | JWT (jose) + httpOnly cookies |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| 桌面端 | Tauri (Rust) + Solid + Vite，本地 ONNX 推理（开发中——见 [`ROADMAP.md`](ROADMAP.md)） |

---

## 功能特性

- **文档导入** — 上传 PDF、Markdown 或纯文本文件，自动完成解析、分块与双路向量嵌入
- **语义搜索** — 使用自然语言检索文档，基于 pgvector 相似度搜索（HNSW 索引）
- **多模型支持** — 可选 GPT-4o Mini、GPT-4o、Claude 3 Haiku 或 Claude 3.5 Sonnet 进行导入处理
- **高保真 PDF 解析** — PDF 通过 docling 边车解析,支持版式/表格/图片感知分块与保真度指标
- **API Key 管理** — 通过程序化方式访问你的知识库
- **MCP 服务器** — 支持 Model Context Protocol,用于工具集成
- **桌面端“这看起来像 B”** *(开发中)* — 通过本地 Tauri 客户端在设备上镜像语料库,实现系统级相似度提示

---

## 仓库结构

npm workspaces 单体仓库。可在仓库根目录通过 workspace flags 运行命令,
也可 `cd` 进入应用目录。

| 路径 | Workspace | 说明 |
|------|-----------|------|
| `apps/memex/` | `@memex/web` | Next.js 16 App Router Web 应用 — 认证、导入、检索、chat RAG。 |
| `apps/docling/` | — | Python FastAPI 边车,封装 docling PDF 解析器,容器化部署。 |
| `apps/desktop/` | `@memex/desktop` | Tauri (Rust + Solid) 客户端,服务于相似度功能。Phase 1 骨架 — 捕获/UI 待实现。 |
| `apps/extension/` | `@memex/extension` | WXT 浏览器扩展。相似度功能已弃用此路径。 |
| `packages/` | — | 共享包预留位置。 |

桌面端相似度功能规划详见 [`ROADMAP.md`](ROADMAP.md)。

## 快速开始

### 前置条件

- Node.js 20+
- 已启用 `pgvector` 扩展的 Supabase 项目
- OpenAI API Key(向量嵌入必需)
- Anthropic API Key(可选,用于 Claude 模型)
- Docker(仅当本地运行 docling 边车以处理 PDF 导入时需要)
- Rust ≥1.77 + tauri-cli(仅当开发 `apps/desktop` 时需要)

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `apps/memex/.env.local`:

```env
DATABASE_URL=postgresql://...      # 连接池地址(pgbouncer)
DIRECT_URL=postgresql://...        # 直连地址(用于迁移)
JWT_SECRET=<your-hs256-secret>
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...       # 可选

DOCLING_URL=http://localhost:8000  # docling 边车;Railway 上使用 http://<svc>.railway.internal:<port>
DOCLING_SHARED_SECRET=<shared>     # 必须与 docling 服务的同名环境变量一致

HF_ENDPOINT=https://hf-mirror.com  # 可选。若 huggingface.co 被屏蔽,使用镜像。
```

### 3. 执行数据库迁移

```bash
cd apps/memex
npx prisma migrate dev
```

### 4. 启动 Web 开发服务器

在仓库根目录:

```bash
npm run dev:web        # http://localhost:3000
```

### 5. (可选)启动 docling 边车以支持 PDF 导入

```bash
cd apps/docling
docker build -f Dockerfile -t memex-docling ..
docker run --rm -p 8000:8000 -e DOCLING_SHARED_SECRET=<shared> memex-docling
```

### 6. (可选)为历史数据回填 `simVector`

在已有数据库应用 `add_sim_vector` 迁移后,需要执行一次回填,
让相似度功能看到完整的语料库:

```bash
cd apps/memex
npx tsx scripts/backfill-simvector.ts --dry-run    # 统计 null 数量
npx tsx scripts/backfill-simvector.ts              # 执行回填
BATCH=200 npx tsx scripts/backfill-simvector.ts    # 调整批大小
```

幂等且支持断点续跑。

打开 [http://localhost:3000](http://localhost:3000)。

---

## 项目结构

以下路径相对于 `apps/memex/`。

```
app/
├── (registration)/login|register   # 认证页面
├── (dashboard)/dashboard           # 主界面
├── api/v1/
│   ├── auth/login|register|logout  # 认证接口
│   ├── documents/                  # 文档列表
│   ├── ingest/file/                # 文件上传与导入(双路嵌入)
│   ├── retrieval/                  # 语义检索
│   ├── vectorSearchOnly/           # 纯向量搜索
│   ├── sections/sync/              # 桌面端增量同步(仅 simVector)
│   └── apiKey/                     # API Key 管理
utils/
├── AI/
│   ├── pipeline/ingest.ts          # 基于 LLM 的文本解析
│   ├── pipeline/retrieval.ts       # 语义检索(RRF + Cohere rerank)
│   ├── pipeline/pdf/index.ts       # docling 边车客户端
│   ├── semanticChunk/chunk.ts      # 基于嵌入的分块
│   ├── embedder.ts                 # 本地 bge-small-en-v1.5(384 维)
│   └── model.ts                    # OpenAI / Anthropic 工厂
├── api/
│   ├── withApiHandlers.ts          # 路由封装(链路追踪、错误处理)
│   ├── Errors.ts                   # AppError 类
│   └── response.ts                 # 类型化响应工具
└── prisma/prisma.ts                # 共享 PrismaClient
scripts/
└── backfill-simvector.ts           # 一次性 + 可续跑的 simVector 回填脚本
mcp/index.ts                        # MCP 服务器入口
```

---

## API 参考

所有响应遵循统一结构：

```json
// 成功
{ "success": true, "data": <T> }

// 错误
{ "success": false, "error": { "code": "...", "message": "..." }, "traceId": "..." }
```

所有受保护的路由均需要有效的 `auth_token` Cookie。

### 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/v1/auth/register` | 注册账户（用户名、邮箱、密码） |
| `POST` | `/api/v1/auth/login` | 登录（用户名或邮箱 + 密码） |
| `POST` | `/api/v1/auth/logout` | 清除 Cookie |

### 文档

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/v1/documents` | 获取当前用户的文档列表 |
| `POST` | `/api/v1/ingest/file` | 上传并导入文件 |

**导入文件** — multipart 表单字段：

| 字段 | 类型 | 可选值 |
|---|---|---|
| `file` | File | `.pdf`、`.md`、`.txt`（最大 100 MB） |
| `documentTitle` | string | 文档显示名称 |
| `model` | string | `gpt-4o-mini`、`gpt-4o`、`claude-3-haiku-20240307`、`claude-3-5-sonnet-20241022` |

### 检索

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/v1/retrieval` | 对索引内容进行语义检索 |
| `POST` | `/api/v1/vectorSearchOnly` | 纯 pgvector 相似度搜索 |

### API Key

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/v1/apiKey` | 按名称查询 API Key |
| `POST` | `/api/v1/apiKey` | 创建新的 API Key |

---

## 导入流程

```
PDF  ──► docling 边车 (HTTP) ──► 版式感知章节(TEXT/TABLE/FIGURE)
MD   ──► mdast AST ────────────► 按标题层级提取章节
TXT  ────────────────────────► 语义分块(3000 字符)
                                       │
                                 LLM 结构化输出
                                 (sectionContent, chunkIndex)
                                       │
                                 ┌───────────────┐
                                 │    并行处理    │
                                 ├───────────────┤
                  OpenAI text-embedding-3-small (1536 维) → sectionVector
                  bge-small-en-v1.5             ( 384 维) → simVector
                                       │
                                 pgvector 写入(与 QC run 同一事务)
```

两路向量均建立 HNSW 索引。`sectionVector` 驱动 chat RAG;
`simVector` 通过 `/api/v1/sections/sync` 喂给桌面端相似度副本。

---

## 数据模型

```
User(用户)
 ├── documents[]        Document(文档)
 │    ├── sections[]   DocumentSection(文档片段)
 │    │                  sectionVector: vector(1536)   — OpenAI text-embedding-3-small,chat RAG
 │    │                  simVector:     vector(384)?   — bge-small-en-v1.5,桌面端相似度
 │    │                  searchVector:  tsvector       — BM25
 │    └── qualityRuns[] ChunkQualityRun                — 每次导入的分块 QC 指标
 ├── thirdPartyAuths[]  ThirdPartyAuth                  (GOOGLE | GITHUB)
 └── apikeys[]          APIKey(API 密钥)
```

---

## MCP 服务器

Memex 提供 Model Context Protocol 服务器，支持工具集成（如 Claude Desktop）。

```bash
npm run mcp
```

---

## 已知问题

### 语义分块准确性
余弦相似度分块器（`utils/AI/semanticChunk/chunk.ts`）通过计算句子间的嵌入距离进行切分，在以下场景表现欠佳：
- 主题高度集中的密集文档——相似度分数无法产生有意义的切分边界
- 短文档——自适应阈值失准，导致生成过大的块或整篇归为单一块

### LLM 内容漂移
纯文本导入时，每个文本块会通过 `ingestText` 传给 LLM 以提取结构化章节。尽管 Prompt 明确要求模型保留原始语言、逐字还原内容，模型偶尔仍会：
- **过度总结** — 丢失原文细节
- **自动翻译** — 尤其在源语言非英文时

这导致索引中存储的 `sectionContent` 可能与原文不符，降低检索质量。目前考虑的缓解方案包括：更严格的 Prompt 约束、基于源块的输出校验，以及对纯文本改用仅分块策略（去除 LLM 改写）。

---

## 路线图

桌面端"这看起来像 B"相似度功能(双路嵌入 + Tauri 改造)进度详见
[`ROADMAP.md`](ROADMAP.md)。

### 检索与搜索
- [x] 混合检索(`utils/AI/pipeline/retrieval.ts`)——pgvector + BM25 通过 RRF 融合,Cohere 重排序
- [ ] 来源引用——在检索结果中标注具体的 `DocumentSection` 与 chunk 位置

### 文档导入
- [x] 通过 docling 边车进行 PDF 解析(版式/表格/图片感知,带保真度指标)
- [x] 导入时双路嵌入(OpenAI 1536 维 + bge 384 维)
- [ ] Web URL 导入(`app/api/v1/ingest/url/`)——抓取并索引网页内容
- [ ] Notion 集成——通过 OAuth 拉取 Notion 页面
- [ ] 纯文本改用仅提取策略,消除 LLM 内容漂移
- [ ] 优化分块器——采用余弦相似度 + Token 数量硬上限的混合策略

### 桌面端相似度("这看起来像 B")
- [x] 云端基础——`simVector` 列、HNSW 索引、双路嵌入导入、回填脚本、`/api/v1/sections/sync` 接口
- [x] 桌面端 Tauri 骨架——Rust 后端(embedder/reranker/store/sync) + Solid 前端
- [ ] Phase 2 —— 系统级捕获(Windows UIA / macOS Accessibility,焦点防抖循环,隐私控制)
- [ ] Phase 3 —— 相似度面板 UI(分层文档级 + 章节级,阈值过滤)

### 设置与配置界面
- [ ] **密钥管理器** — 在应用内配置 `OPENAI_API_KEY`、`ANTHROPIC_API_KEY` 等环境变量,无需手动编辑 `.env.local`
- [ ] **Claude Code / MCP 配置界面** — 可视化编辑 MCP 服务器设置与 Claude Code 集成参数,并自动写入对应配置文件

### API 与集成
- [ ] 完善 API Key 管理(`app/api/v1/apiKey/`)——支持生成、轮换与撤销
- [ ] 扩展 MCP 工具——将检索与导入功能暴露为可调用的 MCP 工具

### 认证
- [ ] Google 与 GitHub OAuth(数据模型已通过 `ThirdPartyAuth` 预留)

### 基础设施
- [ ] 导入接口限流
- [ ] 大文件导入异步任务队列(避免大型 PDF 请求超时)
- [ ] 为 `sectionVector` 添加 HNSW 索引以加速 chat-RAG kNN(已在 `add_sim_vector` 迁移中与 `simVector` 索引一并添加)

---

## 开发命令

在仓库根目录:

```bash
npm run dev:web        # @memex/web —— Next dev (http://localhost:3000)
npm run dev:ext        # @memex/extension —— WXT dev(以 unpacked 方式加载到 Chrome)
npm run build:web      # Next 生产构建(先执行 prisma generate)
npm run build:ext      # WXT 生产构建
npm run lint           # 跨 workspaces 执行 ESLint(--if-present)
```

或按 workspace 单独运行:

```bash
npm -w @memex/web run dev
npm -w @memex/extension run dev
```

### Prisma (在 `apps/memex/` 下执行)

```bash
npx prisma generate    # Schema 变更后重新生成 Prisma 客户端
npx prisma migrate dev # 应用迁移
npx prisma db push     # 推送 Schema 变更(不生成迁移记录)
```

### 桌面端 (Tauri —— `apps/desktop/`)

```bash
cd apps/desktop
npm install
# 按 src-tauri/resources/README.md 下载 ONNX 模型(bge-small-en-v1.5 + bge-reranker-base)
npm run tauri:dev      # 需要 Rust >= 1.77 + tauri-cli
```

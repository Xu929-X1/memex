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
| 数据库 | PostgreSQL via Supabase + pgvector |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| LLM | OpenAI (GPT-4o) / Anthropic (Claude 3.5) via LangChain |
| 认证 | JWT (jose) + httpOnly cookies |
| UI | React 19, Tailwind CSS v4, shadcn/ui |

---

## 功能特性

- **文档导入** — 上传 PDF、Markdown 或纯文本文件，自动完成解析、分块与向量嵌入
- **语义搜索** — 使用自然语言检索文档，基于 pgvector 相似度搜索
- **多模型支持** — 可选 GPT-4o Mini、GPT-4o、Claude 3 Haiku 或 Claude 3.5 Sonnet 进行导入处理
- **API Key 管理** — 通过程序化方式访问你的知识库
- **MCP 服务器** — 支持 Model Context Protocol，用于工具集成

---

## 快速开始

### 前置条件

- Node.js 20+
- 已启用 `pgvector` 扩展的 Supabase 项目
- OpenAI API Key（向量嵌入必需）
- Anthropic API Key（可选，用于 Claude 模型）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env.local`：

```env
DATABASE_URL=postgresql://...      # 连接池地址（pgbouncer）
DIRECT_URL=postgresql://...        # 直连地址（用于迁移）
JWT_SECRET=<your-hs256-secret>
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...       # 可选
```

### 3. 执行数据库迁移

```bash
npx prisma migrate dev
```

### 4. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

---

## 项目结构

```
app/
├── (registration)/login|register   # 认证页面
├── (dashboard)/dashboard           # 主界面
├── api/v1/
│   ├── auth/login|register|logout  # 认证接口
│   ├── documents/                  # 文档列表
│   ├── ingest/file/                # 文件上传与导入
│   ├── retrieval/                  # 语义检索
│   ├── vectorSearchOnly/           # 纯向量搜索
│   └── apiKey/                     # API Key 管理
utils/
├── AI/
│   ├── pipeline/ingest.ts          # 基于 LLM 的文本解析
│   ├── pipeline/retrieval.ts       # 语义检索
│   ├── semanticChunk/chunk.ts      # 基于嵌入的分块
│   └── model.ts                    # OpenAI / Anthropic 工厂
├── api/
│   ├── withApiHandlers.ts          # 路由封装（链路追踪、错误处理）
│   ├── Errors.ts                   # AppError 类
│   └── response.ts                 # 类型化响应工具
└── prisma/prisma.ts                # 共享 PrismaClient
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
PDF  ──► pdf-parse ──► parseText
MD   ──► mdast AST ──► 按标题层级提取章节
TXT  ──────────────► 语义分块（3000 字符）
                           │
                     LLM 结构化输出
                     (sectionContent, headingContext, chunkIndex)
                           │
                     OpenAI text-embedding-3-small（1536 维）
                           │
                     pgvector 写入
```

---

## 数据模型

```
User（用户）
 ├── documents[]        Document（文档）
 │    └── sections[]   DocumentSection（文档片段，含 vector(1536) 向量）
 ├── thirdPartyAuths[]  ThirdPartyAuth（第三方登录，GOOGLE | GITHUB）
 └── apikeys[]          APIKey（API 密钥）
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

### 检索与搜索
- [ ] 完成检索流水线（`utils/AI/pipeline/retrieval.ts`）——结合 pgvector 相似度与关键词匹配的混合检索
- [ ] 集成 Cohere 重排序（依赖已引入）
- [ ] 来源引用——在检索结果中标注具体的 `DocumentSection` 与 chunk 位置

### 文档导入
- [ ] Web URL 导入（`app/api/v1/ingest/url/`）——抓取并索引网页内容
- [ ] Notion 集成——通过 OAuth 拉取 Notion 页面
- [ ] 纯文本改用仅提取策略，消除 LLM 内容漂移
- [ ] 优化分块器——采用余弦相似度 + Token 数量硬上限的混合策略

### 设置与配置界面
- [ ] **密钥管理器** — 在应用内配置 `OPENAI_API_KEY`、`ANTHROPIC_API_KEY` 等环境变量，无需手动编辑 `.env.local`
- [ ] **Claude Code / MCP 配置界面** — 可视化编辑 MCP 服务器设置与 Claude Code 集成参数，并自动写入对应配置文件

### API 与集成
- [ ] 完善 API Key 管理（`app/api/v1/apiKey/`）——支持生成、轮换与撤销
- [ ] 扩展 MCP 工具——将检索与导入功能暴露为可调用的 MCP 工具

### 认证
- [ ] Google 与 GitHub OAuth（数据模型已通过 `ThirdPartyAuth` 预留）

### 基础设施
- [ ] 导入接口限流
- [ ] 大文件导入异步任务队列（避免大型 PDF 请求超时）

---

## 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建（自动执行 prisma generate）
npm run lint         # ESLint 检查
npx prisma generate  # Schema 变更后重新生成 Prisma 客户端
npx prisma db push   # 推送 Schema 变更（不生成迁移记录）
```

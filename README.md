# Memex

[中文版](./README.zh.md)

```text
"Consider a future device ... in which an individual stores all his books, records, and communications,
and which is mechanized so that it may be consulted with exceeding speed and flexibility.
It is an enlarged intimate supplement to his memory."

— Vannevar Bush
```

A personal knowledge engine. Ingest your documents, index them semantically, and retrieve anything with natural language.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | PostgreSQL via Supabase + pgvector |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| LLM | OpenAI (GPT-4o) / Anthropic (Claude 3.5) via LangChain |
| Auth | JWT (jose) + httpOnly cookies |
| UI | React 19, Tailwind CSS v4, shadcn/ui |

---

## Features

- **Document ingestion** — upload PDF, Markdown, or plain text files; they are parsed, chunked, and embedded automatically
- **Semantic search** — query your documents in natural language using pgvector similarity search
- **Multi-LLM** — choose between GPT-4o Mini, GPT-4o, Claude 3 Haiku, or Claude 3.5 Sonnet for ingestion
- **API key management** — programmatic access to your knowledge base
- **MCP server** — Model Context Protocol support for tool-based integrations

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project with the `pgvector` extension enabled
- OpenAI API key (required for embeddings)
- Anthropic API key (optional, for Claude models)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` in the project root:

```env
DATABASE_URL=postgresql://...      # Pooled connection string (pgbouncer)
DIRECT_URL=postgresql://...        # Direct connection string (for migrations)
JWT_SECRET=<your-hs256-secret>
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...       # Optional
```

### 3. Run migrations

```bash
npx prisma migrate dev
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
├── (registration)/login|register   # Auth pages
├── (dashboard)/dashboard           # Main app UI
├── api/v1/
│   ├── auth/login|register|logout  # Auth endpoints
│   ├── documents/                  # List user documents
│   ├── ingest/file/                # File upload & ingestion
│   ├── retrieval/                  # Semantic search
│   ├── vectorSearchOnly/           # Raw vector search
│   └── apiKey/                     # API key management
utils/
├── AI/
│   ├── pipeline/ingest.ts          # LLM-based text parsing
│   ├── pipeline/retrieval.ts       # Semantic retrieval
│   ├── semanticChunk/chunk.ts      # Embedding-based chunking
│   └── model.ts                    # OpenAI / Anthropic factory
├── api/
│   ├── withApiHandlers.ts          # Route wrapper (tracing, errors)
│   ├── Errors.ts                   # AppError class
│   └── response.ts                 # Typed response helpers
└── prisma/prisma.ts                # Shared PrismaClient
mcp/index.ts                        # MCP server entry point
```

---

## API Reference

All responses follow this envelope:

```json
// Success
{ "success": true, "data": <T> }

// Error
{ "success": false, "error": { "code": "...", "message": "..." }, "traceId": "..." }
```

All protected routes require a valid `auth_token` cookie.

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Create account (username, email, password) |
| `POST` | `/api/v1/auth/login` | Login (identifier, password) |
| `POST` | `/api/v1/auth/logout` | Clear session cookie |

### Documents

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/documents` | List authenticated user's documents |
| `POST` | `/api/v1/ingest/file` | Upload and ingest a file |

**Ingest file** — multipart form fields:

| Field | Type | Values |
|---|---|---|
| `file` | File | `.pdf`, `.md`, `.txt` (max 100 MB) |
| `documentTitle` | string | Display name |
| `model` | string | `gpt-4o-mini`, `gpt-4o`, `claude-3-haiku-20240307`, `claude-3-5-sonnet-20241022` |

### Retrieval

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/retrieval` | Semantic search over indexed sections |
| `POST` | `/api/v1/vectorSearchOnly` | Raw pgvector similarity search |

### API Keys

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/apiKey` | Retrieve an API key by name |
| `POST` | `/api/v1/apiKey` | Create a new API key |

---

## Ingestion Pipeline

```
PDF  ──► pdf-parse ──► parseText
MD   ──► mdast AST ──► heading hierarchy extraction
TXT  ──────────────► semantic chunking (3000 chars)
                           │
                     LLM structured output
                     (sectionContent, headingContext, chunkIndex)
                           │
                     OpenAI text-embedding-3-small (1536-dim)
                           │
                     pgvector INSERT
```

---

## Data Models

```
User
 ├── documents[]        Document
 │    └── sections[]   DocumentSection  (sectionVector: vector(1536))
 ├── thirdPartyAuths[]  ThirdPartyAuth   (GOOGLE | GITHUB)
 └── apikeys[]          APIKey
```

---

## MCP Server

Memex exposes a Model Context Protocol server for tool-based integrations (e.g. Claude Desktop).

```bash
npm run mcp
```

---

## Known Challenges

### Semantic chunking accuracy
The cosine-similarity-based chunker (`utils/AI/semanticChunk/chunk.ts`) splits text by measuring embedding distance between sentences. This approach struggles with:
- Dense, uniform-topic documents where similarity scores don't produce meaningful boundaries
- Short documents where the adaptive threshold misfires and produces oversized or single-chunk results

### LLM summarization drift
During plain-text ingestion, each chunk is passed to the LLM via `ingestText` to extract structured sections. Despite the prompt explicitly instructing the model to preserve the original language and reproduce content verbatim, the model occasionally:
- **Summarizes** instead of extracting — losing detail from the source material
- **Translates** content — particularly when the source language is not English

This means the indexed `sectionContent` may not faithfully represent the original document, degrading retrieval quality. Mitigation options under consideration include stricter prompt constraints, output validation against the source chunk, and switching to a chunking-only strategy (no LLM rewriting) for plain text.

---

## Roadmap

### Retrieval & search
- [ ] Complete the retrieval pipeline (`utils/AI/pipeline/retrieval.ts`) — hybrid search combining pgvector similarity with keyword matching
- [ ] Re-ranking with Cohere (dependency already included)
- [ ] Source citations — surface the exact `DocumentSection` and chunk index that answered a query

### Ingestion
- [ ] Web URL ingestion (`app/api/v1/ingest/url/`) — crawl and index web pages
- [ ] Notion integration — pull pages via Notion API using OAuth
- [ ] Replace LLM-rewriting with extraction-only for plain text to eliminate summarization drift
- [ ] Improve chunker with a hybrid strategy (cosine + token budget hard cap)

### Settings & configuration UI
- [ ] **Secrets manager** — in-app interface to configure `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and other environment variables without touching `.env.local` directly
- [ ] **Claude Code / MCP config UI** — visual editor for MCP server settings and Claude Code integration parameters, writing to the appropriate config files

### API & integrations
- [ ] Complete API key CRUD (`app/api/v1/apiKey/`) — generate, rotate, and revoke programmatic access keys
- [ ] MCP tool expansion — expose retrieval and ingestion as callable MCP tools

### Auth
- [ ] Google and GitHub OAuth (models already in schema via `ThirdPartyAuth`)

### Infrastructure
- [ ] Rate limiting on ingestion endpoints
- [ ] Background job queue for large file ingestion (avoid request timeouts on large PDFs)

---

## Development

```bash
npm run dev          # Start dev server
npm run build        # Production build (runs prisma generate first)
npm run lint         # ESLint
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma db push   # Push schema without migration history
```

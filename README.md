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
| Database | PostgreSQL via Supabase + pgvector (HNSW) |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| LLM | OpenAI (GPT-4o) / Anthropic (Claude 3.5) via LangChain |
| Embedders | OpenAI `text-embedding-3-small` (1536d, chat RAG) + local `bge-small-en-v1.5` (384d, similarity feature) via `@xenova/transformers` |
| PDF parsing | [docling](https://github.com/DS4SD/docling) Python sidecar (FastAPI, containerized) |
| Auth | JWT (jose) + httpOnly cookies |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Desktop | Tauri (Rust) + Solid + Vite, local ONNX inference (in progress — see [`ROADMAP.md`](ROADMAP.md)) |

---

## Features

- **Document ingestion** — upload PDF, Markdown, or plain text files; they are parsed, chunked, and dual-embedded automatically
- **Semantic search** — query your documents in natural language using pgvector similarity search (HNSW-indexed)
- **Multi-LLM** — choose between GPT-4o Mini, GPT-4o, Claude 3 Haiku, or Claude 3.5 Sonnet for ingestion
- **PDF fidelity** — PDFs are parsed via the docling sidecar with layout/table/figure-aware chunking and retention metrics
- **API key management** — programmatic access to your knowledge base
- **MCP server** — Model Context Protocol support for tool-based integrations
- **Desktop "looks like B"** *(in progress)* — system-wide similarity surfacing via a local Tauri client that mirrors your corpus on-device

---

## Repo layout

npm workspaces monorepo. Run commands from the repo root via workspace flags,
or `cd` into the app directory.

| Path | Workspace | What |
|------|-----------|------|
| `apps/memex/` | `@memex/web` | Next.js 16 App Router web app — auth, ingestion, retrieval, chat RAG. |
| `apps/docling/` | — | Python FastAPI sidecar wrapping the docling PDF parser. Containerized. |
| `apps/desktop/` | `@memex/desktop` | Tauri (Rust + Solid) shell for the similarity feature. Phase 1 scaffold — capture/UI deferred. |
| `apps/extension/` | `@memex/extension` | WXT browser extension. Deprecated for the similarity feature. |
| `packages/` | — | Reserved for shared packages. |

See [`ROADMAP.md`](ROADMAP.md) for the desktop similarity-feature plan.

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project with the `pgvector` extension enabled
- OpenAI API key (required for embeddings)
- Anthropic API key (optional, for Claude models)
- Docker (only if running the docling sidecar locally for PDF ingest)
- Rust ≥1.77 + tauri-cli (only for `apps/desktop` development)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `apps/memex/.env.local`:

```env
DATABASE_URL=postgresql://...      # Pooled connection string (pgbouncer)
DIRECT_URL=postgresql://...        # Direct connection string (for migrations)
JWT_SECRET=<your-hs256-secret>
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...       # Optional

DOCLING_URL=http://localhost:8000  # docling sidecar; on Railway use http://<svc>.railway.internal:<port>
DOCLING_SHARED_SECRET=<shared>     # Must match the same env on the docling service

HF_ENDPOINT=https://hf-mirror.com  # Optional. Use a mirror if huggingface.co is blocked.
```

### 3. Run migrations

```bash
cd apps/memex
npx prisma migrate dev
```

### 4. Start the web dev server

From the repo root:

```bash
npm run dev:web        # http://localhost:3000
```

### 5. (Optional) Start the docling sidecar for PDF ingest

```bash
cd apps/docling
docker build -f Dockerfile -t memex-docling ..
docker run --rm -p 8000:8000 -e DOCLING_SHARED_SECRET=<shared> memex-docling
```

### 6. (Optional) Backfill `simVector` for legacy rows

Required once after applying the `add_sim_vector` migration in an existing
database, so the similarity feature sees a consistent corpus:

```bash
cd apps/memex
npx tsx scripts/backfill-simvector.ts --dry-run    # count nulls
npx tsx scripts/backfill-simvector.ts              # populate
BATCH=200 npx tsx scripts/backfill-simvector.ts    # tune batch size
```

Idempotent and resumable.

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

All paths below are relative to `apps/memex/`.

```
app/
├── (registration)/login|register   # Auth pages
├── (dashboard)/dashboard           # Main app UI
├── api/v1/
│   ├── auth/login|register|logout  # Auth endpoints
│   ├── documents/                  # List user documents
│   ├── ingest/file/                # File upload & ingestion (dual-embed)
│   ├── retrieval/                  # Semantic search
│   ├── vectorSearchOnly/           # Raw vector search
│   ├── sections/sync/              # Desktop incremental sync (simVector only)
│   └── apiKey/                     # API key management
utils/
├── AI/
│   ├── pipeline/ingest.ts          # LLM-based text parsing
│   ├── pipeline/retrieval.ts       # Semantic retrieval (RRF + Cohere rerank)
│   ├── pipeline/pdf/index.ts       # docling sidecar client
│   ├── semanticChunk/chunk.ts      # Embedding-based chunking
│   ├── embedder.ts                 # Local bge-small-en-v1.5 (384d)
│   └── model.ts                    # OpenAI / Anthropic factory
├── api/
│   ├── withApiHandlers.ts          # Route wrapper (tracing, errors)
│   ├── Errors.ts                   # AppError class
│   └── response.ts                 # Typed response helpers
└── prisma/prisma.ts                # Shared PrismaClient
scripts/
└── backfill-simvector.ts           # One-time + resumable simVector backfill
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
PDF  ──► docling sidecar (HTTP) ──► layout-aware sections (TEXT/TABLE/FIGURE)
MD   ──► mdast AST ──────────────► heading hierarchy extraction
TXT  ──────────────────────────► semantic chunking (3000 chars)
                                       │
                                 LLM structured output
                                 (sectionContent, chunkIndex)
                                       │
                                 ┌───────────────┐
                                 │   parallel    │
                                 ├───────────────┤
                  OpenAI text-embedding-3-small (1536d) → sectionVector
                  bge-small-en-v1.5             ( 384d) → simVector
                                       │
                                 pgvector INSERT (single transaction with QC run)
```

Both vectors are HNSW-indexed. `sectionVector` drives chat RAG; `simVector`
feeds the desktop similarity replica via `/api/v1/sections/sync`.

---

## Data Models

```
User
 ├── documents[]        Document
 │    ├── sections[]   DocumentSection
 │    │                  sectionVector: vector(1536)   — OpenAI text-embedding-3-small, chat RAG
 │    │                  simVector:     vector(384)?   — bge-small-en-v1.5, desktop similarity
 │    │                  searchVector:  tsvector       — BM25
 │    └── qualityRuns[] ChunkQualityRun                — per-ingest chunk QC metrics
 ├── thirdPartyAuths[]  ThirdPartyAuth                  (GOOGLE | GITHUB)
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

See [`ROADMAP.md`](ROADMAP.md) for the in-flight "this looks like B" desktop
similarity feature (dual-embedding + Tauri pivot).

### Retrieval & search
- [x] Hybrid retrieval (`utils/AI/pipeline/retrieval.ts`) — pgvector + BM25 fused via RRF, Cohere rerank
- [ ] Source citations — surface the exact `DocumentSection` and chunk index that answered a query

### Ingestion
- [x] PDF parsing via docling sidecar (layout/table/figure-aware, fidelity metrics)
- [x] Dual embedding (OpenAI 1536d + bge 384d) at ingest
- [ ] Web URL ingestion (`app/api/v1/ingest/url/`) — crawl and index web pages
- [ ] Notion integration — pull pages via Notion API using OAuth
- [ ] Replace LLM-rewriting with extraction-only for plain text to eliminate summarization drift
- [ ] Improve chunker with a hybrid strategy (cosine + token budget hard cap)

### Desktop similarity ("this looks like B")
- [x] Cloud foundation — `simVector` column, HNSW indexes, dual-embed ingest, backfill script, `/api/v1/sections/sync` endpoint
- [x] Desktop Tauri scaffold — Rust backend (embedder/reranker/store/sync) + Solid frontend
- [ ] Phase 2 — OS-level capture (Windows UIA / macOS Accessibility, debounced focus loop, privacy controls)
- [ ] Phase 3 — Similarity panel UI (layered doc-level + section-level, threshold gating)

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
- [ ] HNSW index on `sectionVector` for chat-RAG kNN (added alongside `simVector` index in the `add_sim_vector` migration)

---

## Development

From the repo root:

```bash
npm run dev:web        # @memex/web — Next dev (http://localhost:3000)
npm run dev:ext        # @memex/extension — WXT dev (loads unpacked into Chrome)
npm run build:web      # Next production build (runs prisma generate first)
npm run build:ext      # WXT production build
npm run lint           # ESLint across workspaces (--if-present)
```

Or per workspace:

```bash
npm -w @memex/web run dev
npm -w @memex/extension run dev
```

### Prisma (run from `apps/memex/`)

```bash
npx prisma generate    # Regenerate Prisma client after schema changes
npx prisma migrate dev # Apply migrations
npx prisma db push     # Push schema without migration history
```

### Desktop (Tauri — `apps/desktop/`)

```bash
cd apps/desktop
npm install
# Download ONNX models per src-tauri/resources/README.md (bge-small-en-v1.5 + bge-reranker-base)
npm run tauri:dev      # requires Rust >= 1.77 + tauri-cli
```

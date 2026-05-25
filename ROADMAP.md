# Roadmap

## "This A looks like B" — system-wide similarity surfacing

### Context

memex should surface "this looks like B" whenever the user views something on their machine. A = currently-viewed page/section (transient, anywhere on the OS). B = ingested DocumentSections in the user's corpus.

Constraints:
- **System-wide capture** — anywhere on the machine (not just web).
- **Latency target <300ms cold** — must run local end-to-end.
- **Pivot apps/desktop from Perry to Tauri** — Perry stdlib has no UIA/Accessibility/OCR/local ML; Tauri (Rust) has mature crates.
- **Local ONNX embedder** (bge-small-en or similar) for A. Same model both sides → corpus must also have bge vectors.
- **Preserve existing ingestion pipeline** — OpenAI `text-embedding-3-small` (1536d) stays. Add bge alongside as a second vector column (dual-embedding), do NOT replace.
- **Corpus B = DocumentSection only** for v1. Browser extension deprecated; user-action signal revisit later.
- **Layered UI**: doc-level on open + section-level as user reads.

Current state:
- `apps/desktop/src/main.ts` is a Perry counter stub. Nothing real to migrate.
- `DocumentSection.sectionVector vector(1536)` (OpenAI `text-embedding-3-small`). **No HNSW index** — kNN is seq scan. Stays as-is, used by chat RAG.
- `apps/memex/utils/AI/pipeline/retrieval.ts` already has RRF + Cohere rerank — untouched; reuse RRF concept locally on desktop.
- `apps/extension/` exists but deprecated for this feature.

Outcome: a desktop app that watches foreground window, embeds visible text locally, runs kNN against a local replica of the user's corpus, reranks, and surfaces matches in a floating panel — all in <300ms warm, <500ms cold.

---

### Architecture

```
[OS foreground window]
    ↓ (UIA on Win / AX on macOS, debounced)
[Tauri Rust backend]
    ├─ embed.rs    (ort + bge-small-en-v1.5, 384d)
    ├─ store.rs    (sqlite + sqlite-vec, local replica)
    ├─ rerank.rs   (ort + bge-reranker-base)
    ├─ capture.rs  (uiautomation / accessibility-sys / tesseract fallback)
    └─ sync.rs     (pull from cloud /api/v1/sections/sync)
    ↓
[Tauri frontend — sidebar/overlay]
    Doc-level panel  +  Section-level panel
```

**Latency budget (cold path, external A):**

| Step | Target |
|------|--------|
| Capture foreground text | 30-60ms |
| Embed A (local bge-small ONNX, CPU) | 30-60ms |
| sqlite-vec kNN top-50 | 5-20ms |
| Local cross-encoder rerank top-50 → top-5 | 100-200ms |
| **Total** | **~200-340ms** |

Warm path (same A, cached embedding): <50ms.

---

### Phase 0 — Cloud foundation (additive only, pipeline preserved)

Goal: add a parallel bge embedding to every section without touching the existing OpenAI pipeline or retrieval flow.

1. **Add bge embedder util** (additive): `apps/memex/utils/AI/embedder.ts` — singleton `@xenova/transformers` pipeline loading `bge-small-en-v1.5`. CPU-feasible in the Node API process.

2. **Schema additive migration**: ADD column `simVector vector(384)` on `DocumentSection`. ADD HNSW index on the new column. Existing `sectionVector vector(1536)` and its callers stay exactly as-is.
   ```sql
   ALTER TABLE "DocumentSection" ADD COLUMN "simVector" vector(384);
   CREATE INDEX ON "DocumentSection" USING hnsw ("simVector" vector_cosine_ops);
   -- Optional but recommended: also index existing sectionVector for chat RAG
   CREATE INDEX ON "DocumentSection" USING hnsw ("sectionVector" vector_cosine_ops);
   ```
   Files: `apps/memex/prisma/schema/document.prisma`, new migration under `apps/memex/prisma/migrations/`.

3. **Ingest dual-embed**: in `apps/memex/app/api/v1/ingest/file/route.ts:104-131`, after computing OpenAI `embeddings` (unchanged), also compute `simEmbeddings` via the new bge util in the same batch loop. Extend the `INSERT INTO "DocumentSection"` raw SQL to write `simVector` too. No other call sites change.

4. **Backfill historical rows**: `apps/memex/scripts/backfill-simvector.ts`. Streams sections where `simVector IS NULL`, batches 100, runs bge, updates. Idempotent and resumable. One-time run on existing corpus.

5. **Retrieval (chat RAG) untouched** — `apps/memex/utils/AI/pipeline/retrieval.ts` keeps using `sectionVector` (1536d OpenAI). No risk of regression to the existing chat product.

---

### Phase 1 — Desktop pivot to Tauri

Goal: replace Perry stub with Tauri shell that can sync corpus locally.

1. **Delete Perry artifacts** in `apps/desktop/`: `perry.toml`, `main.exe`, `.perry/`, current `src/main.ts`.

2. **Scaffold Tauri app**:
   - `apps/desktop/src-tauri/` — Rust backend.
   - `apps/desktop/src/` — frontend (Solid or React, keep light).
   - `apps/desktop/package.json` — swap `@perryts/perry` for `@tauri-apps/cli`.

3. **Rust deps** (`apps/desktop/src-tauri/Cargo.toml`):
   - `tauri` — shell
   - `ort` — ONNX runtime
   - `tokenizers` — HuggingFace tokenizer
   - `rusqlite` + `sqlite-vec` — local vector store
   - `reqwest` — cloud sync

4. **Bundle models** in `apps/desktop/src-tauri/resources/`:
   - `bge-small-en-v1.5.onnx` (~33MB)
   - `bge-reranker-base.onnx` (~95MB)
   - Tokenizer JSON files for both

5. **Local store** (`src-tauri/src/store.rs`):
   - SQLite at platform appdata dir.
   - Tables: `sections(id PK, document_id, content, kind, page_start, page_end, updated_at)` + virtual table `sections_vec USING vec0(embedding float[384])`.

6. **Sync** (`src-tauri/src/sync.rs` + new cloud endpoint `apps/memex/app/api/v1/sections/sync/route.ts`):
   - Cloud endpoint: `GET /api/v1/sections/sync?since=<cursor>` → returns `[{id, documentId, content, simVector, updatedAt, kind, pageStart, pageEnd}]` for current user, paginated. **Returns the 384d `simVector` only**, never the 1536d OpenAI vector.
   - Skips rows where `simVector IS NULL` (backfill in progress) so desktop sees a consistent view.
   - Desktop calls every 5min and at startup. Upsert into SQLite.
   - Auth: reuse JWT — desktop opens login webview, captures cookie, stores in OS keychain.

---

### Phase 2 — OS-level capture

Goal: detect foreground text, debounce, hand to embedder.

1. **`src-tauri/src/capture.rs`**:
   - Windows: `uiautomation` crate → `IUIAutomation::GetFocusedElement` → walk tree for `TextPattern`, concat visible text.
   - macOS: `accessibility-sys` crate → `AXUIElementCopyAttributeValue(kAXFocusedUIElementAttribute)` → recurse for `kAXValueAttribute`/`kAXChildrenAttribute`.
   - Linux: AT-SPI via `atspi` crate (deferred).
   - Fallback: `tesseract-rs` OCR on screenshot region. Opt-in (user toggle) — slow + battery hit.

2. **Focus-change loop** (`src-tauri/src/watcher.rs`):
   - Subscribe to window-focus events (Win: `SetWinEventHook`; mac: `NSWorkspace.didActivateApplicationNotification`).
   - 500ms debounce after focus settles.
   - Emit Tauri event `view-changed` with `{appName, text, timestamp}`.

3. **Privacy controls** in settings UI:
   - App allowlist / blocklist.
   - Pause toggle.
   - "Don't capture from password fields" (UIA `IsPasswordPattern` check).

---

### Phase 3 — Similarity surface

Goal: layered UI panel showing matches.

1. **`src-tauri/src/similar.rs`**:
   - `find_similar(text: &str, granularity: Doc|Section) -> Vec<Match>`:
     - Chunk `text` if Doc (avg pool → single 384d) vs Section (use first ~512 tokens).
     - kNN against `sections_vec` (exclude same `document_id` if A is from corpus).
     - Rerank top-50 with bge-reranker-base.
     - Apply threshold: cosine after rerank > 0.7 OR drop.
     - Return top-5.

2. **Frontend panel** (`apps/desktop/src/`):
   - Two-pane sidebar (floating window or docked).
   - Top: "Similar documents" (3 entries, doc-level).
   - Bottom: "Similar sections" (5 entries, section-level, scroll-tracking).
   - Each match: title, snippet, "open in memex" button → deep-link to web reader.

3. **"No strong matches" state** when threshold filters everything — explicit empty state, not silent.

---

### Critical files

**Modify:**
- `apps/memex/prisma/schema/document.prisma` — ADD `simVector vector(384)` field; keep `sectionVector vector(1536)` intact.
- `apps/memex/app/api/v1/ingest/file/route.ts` — dual-embed (OpenAI + bge), extend INSERT to write `simVector`. Existing OpenAI flow preserved.
- `apps/desktop/package.json`, `apps/desktop/tsconfig.json` — Tauri reconfigure.
- *(No edits to `apps/memex/utils/AI/pipeline/retrieval.ts` — chat RAG unchanged.)*

**New:**
- `apps/memex/utils/AI/embedder.ts` — local bge embedder wrapper (singleton).
- `apps/memex/scripts/backfill-simvector.ts` — one-time + resumable backfill of `simVector` on historical rows.
- `apps/memex/app/api/v1/sections/sync/route.ts` — desktop sync endpoint (serves `simVector` only).
- `apps/memex/prisma/migrations/<ts>_add_simvector/migration.sql` — additive column + HNSW indexes.
- `apps/desktop/src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/{main.rs,embed.rs,rerank.rs,store.rs,sync.rs,capture.rs,watcher.rs,similar.rs}`.
- `apps/desktop/src-tauri/resources/{bge-small-en-v1.5.onnx,bge-reranker-base.onnx,tokenizers/*.json}`.
- `apps/desktop/src/` — frontend pages (settings, similarity panel).

**Delete:**
- `apps/desktop/perry.toml`, `apps/desktop/main.{exe,exp,lib}`, `apps/desktop/.perry/`, `apps/desktop/src/main.ts` (Perry version).

---

### Reuse

- **RRF logic** in `apps/memex/utils/AI/pipeline/retrieval.ts` — port to `src-tauri/src/similar.rs` if hybrid dense+BM25 needed locally (sqlite has FTS5 for BM25).
- **Auth middleware** `apps/memex/middleware.ts` — extend `/api/v1/sections/sync` permissions; reuse `auth_token` cookie flow for desktop login webview.
- **AppError pattern** in `apps/memex/utils/api/Errors.ts` — keep for new sync route.

---

### Verification

**Phase 0 (cloud):**
- Ingest sample PDF → confirm both vectors stored: `SELECT vector_dims(sectionVector), vector_dims(simVector) FROM "DocumentSection" LIMIT 1` returns (1536, 384).
- Existing chat RAG smoke test still passes — confirms preservation.
- `EXPLAIN ANALYZE SELECT ... ORDER BY simVector <=> '[...]' LIMIT 10` shows HNSW index scan on `simVector`.
- Backfill script: dry-run shows N null rows; live run reduces null count to 0; idempotent re-run = no-op.

**Phase 1 (desktop sync):**
- `cargo run` in `apps/desktop/src-tauri/` → app launches, login flow works, sync pulls N rows = cloud row count.
- SQLite inspection: `sqlite3 ... "SELECT count(*) FROM sections"` matches cloud.

**Phase 2 (capture):**
- Open VS Code, Notion, Chrome in turn → capture log shows distinct text per app.
- Focus a password field → captured text empty (IsPasswordPattern honored).
- App blocklist: add Chrome → focus Chrome → no capture.

**Phase 3 (similarity):**
- Hand-label 20 (A, B) pairs as relevant/not.
- Measure top-3 precision: cosine-only baseline vs +rerank vs +threshold gate.
- Latency: instrument capture→render. Confirm <300ms warm, <500ms cold on dev laptop.
- Empty-state UX: read totally novel text → "no strong matches" shown, not random low-score results.

---

### Open decisions (defer to implementation)

- **Frontend framework** for Tauri webview (Solid recommended for size; React if reusing memex components).
- **Embedder pick** — bge-small-en-v1.5 (384d, fastest) vs nomic-embed-text-v1.5 (768d, better). Start small, upgrade if accuracy weak.
- **Linux capture** support (defer; AT-SPI is fiddly).
- **OCR fallback** ship/skip in v1.

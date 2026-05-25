-- Additive: dual-embedding for the "looks like B" similarity feature.
-- The existing sectionVector (1536d, OpenAI text-embedding-3-small) is preserved
-- and remains the basis for chat RAG. simVector (384d, bge-small-en-v1.5) feeds
-- the desktop local replica via /api/v1/sections/sync.

ALTER TABLE "DocumentSection"
  ADD COLUMN "simVector" vector(384);

ALTER TABLE "DocumentSection"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "idx_document_section_updated_at"
  ON "DocumentSection" ("updatedAt");

CREATE INDEX IF NOT EXISTS "idx_document_section_sim_vector_hnsw"
  ON "DocumentSection"
  USING hnsw ("simVector" vector_cosine_ops);

-- Index the existing 1536d vector too; the chat-RAG retrieval pipeline
-- was previously seq-scanning every kNN query.
CREATE INDEX IF NOT EXISTS "idx_document_section_section_vector_hnsw"
  ON "DocumentSection"
  USING hnsw ("sectionVector" vector_cosine_ops);

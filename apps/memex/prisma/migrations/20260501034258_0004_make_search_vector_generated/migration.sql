-- Drop plain tsvector column added in 0003, recreate as generated stored column
ALTER TABLE "DocumentSection" DROP COLUMN IF EXISTS "searchVector";

ALTER TABLE "DocumentSection"
ADD COLUMN "searchVector" tsvector
GENERATED ALWAYS AS (to_tsvector('simple', "sectionContent")) STORED;

CREATE INDEX IF NOT EXISTS idx_document_section_search_vector
ON "DocumentSection" USING GIN("searchVector");

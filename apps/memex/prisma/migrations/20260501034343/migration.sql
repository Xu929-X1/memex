-- DropIndex
DROP INDEX "idx_document_section_search_vector";

-- AlterTable
ALTER TABLE "DocumentSection" ALTER COLUMN "searchVector" DROP DEFAULT;

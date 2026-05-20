-- DropForeignKey
ALTER TABLE "ChunkQualityRun" DROP CONSTRAINT "ChunkQualityRun_documentId_fkey";

-- AddForeignKey
ALTER TABLE "ChunkQualityRun" ADD CONSTRAINT "ChunkQualityRun_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

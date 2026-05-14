-- CreateTable
CREATE TABLE "ChunkQualityRun" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" "SourceType" NOT NULL,
    "totalChunks" INTEGER NOT NULL,
    "textCount" INTEGER NOT NULL,
    "tableCount" INTEGER NOT NULL,
    "figureCount" INTEGER NOT NULL,
    "meanChars" INTEGER NOT NULL,
    "stddevChars" INTEGER NOT NULL,
    "p5Chars" INTEGER NOT NULL,
    "p95Chars" INTEGER NOT NULL,
    "tinyRate" DOUBLE PRECISION NOT NULL,
    "oversizedRate" DOUBLE PRECISION NOT NULL,
    "midSentenceRate" DOUBLE PRECISION NOT NULL,
    "whitespaceRate" DOUBLE PRECISION NOT NULL,
    "boundarySimilarity" DOUBLE PRECISION,
    "score" DOUBLE PRECISION NOT NULL,
    "flags" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,

    CONSTRAINT "ChunkQualityRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChunkQualityRun_documentId_idx" ON "ChunkQualityRun"("documentId");

-- CreateIndex
CREATE INDEX "ChunkQualityRun_createdAt_idx" ON "ChunkQualityRun"("createdAt");

-- AddForeignKey
ALTER TABLE "ChunkQualityRun" ADD CONSTRAINT "ChunkQualityRun_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

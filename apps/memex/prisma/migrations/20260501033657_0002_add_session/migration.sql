/*
  Warnings:

  - You are about to drop the column `searchVector` on the `DocumentSection` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "SeesionType" AS ENUM ('WEB');

-- CreateEnum
CREATE TYPE "SessionActionType" AS ENUM ('HIGHLIGHT', 'COPY', 'PASTE', 'SCROLL', 'SEARCH', 'CLICK_OUT');

-- DropIndex
DROP INDEX "idx_document_section_search_vector";

-- AlterTable
ALTER TABLE "DocumentSection" DROP COLUMN "searchVector";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SeesionType" NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "activeDwellMs" INTEGER NOT NULL DEFAULT 0,
    "scrollDepth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reopenCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionAction" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "SessionActionType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_userId_startedAt_idx" ON "Session"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "SessionAction_sessionId_createdAt_idx" ON "SessionAction"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAction" ADD CONSTRAINT "SessionAction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "SectionKind" AS ENUM ('TEXT', 'TABLE', 'FIGURE');

-- AlterTable
ALTER TABLE "DocumentSection"
  ADD COLUMN "kind" "SectionKind" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN "pageStart" INTEGER,
  ADD COLUMN "pageEnd" INTEGER;

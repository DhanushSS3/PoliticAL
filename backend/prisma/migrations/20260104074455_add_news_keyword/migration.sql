/*
  Warnings:

  - Added the required column `type` to the `Alert` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "NewsIngestType" AS ENUM ('API', 'SCRAPER', 'MANUAL', 'PARTNER');

-- CreateEnum
CREATE TYPE "ManualInputType" AS ENUM ('FILE', 'LINK', 'TEXT');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('GEO_UNIT', 'CANDIDATE', 'PARTY');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('SENTIMENT_SPIKE', 'CONTROVERSY', 'NEWS_MENTION', 'DAILY_PULSE');

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "type" "AlertType" NOT NULL;

-- AlterTable
ALTER TABLE "NewsArticle" ADD COLUMN     "ingestType" "NewsIngestType" NOT NULL DEFAULT 'API',
ADD COLUMN     "manualInputType" "ManualInputType",
ADD COLUMN     "originalFileUrl" TEXT,
ADD COLUMN     "submittedBy" INTEGER;

-- AlterTable
ALTER TABLE "SentimentSignal" ADD COLUMN     "modelVersion" TEXT;

-- CreateTable
CREATE TABLE "NewsEntityMention" (
    "id" SERIAL NOT NULL,
    "articleId" INTEGER NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" INTEGER NOT NULL,

    CONSTRAINT "NewsEntityMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsKeyword" (
    "id" SERIAL NOT NULL,
    "keyword" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsEntityMention_articleId_idx" ON "NewsEntityMention"("articleId");

-- CreateIndex
CREATE INDEX "NewsEntityMention_entityType_entityId_idx" ON "NewsEntityMention"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "NewsKeyword_entityType_entityId_idx" ON "NewsKeyword"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "NewsKeyword_isActive_idx" ON "NewsKeyword"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "NewsKeyword_entityType_entityId_keyword_key" ON "NewsKeyword"("entityType", "entityId", "keyword");

-- CreateIndex
CREATE INDEX "NewsArticle_ingestType_idx" ON "NewsArticle"("ingestType");

-- AddForeignKey
ALTER TABLE "NewsEntityMention" ADD CONSTRAINT "NewsEntityMention_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "SentimentSignal" ADD COLUMN     "relevanceWeight" DOUBLE PRECISION,
ADD COLUMN     "sourceEntityId" INTEGER,
ADD COLUMN     "sourceEntityType" "EntityType";

-- CreateIndex
CREATE INDEX "SentimentSignal_relevanceWeight_idx" ON "SentimentSignal"("relevanceWeight");

-- CreateIndex
CREATE INDEX "SentimentSignal_sourceEntityType_sourceEntityId_idx" ON "SentimentSignal"("sourceEntityType", "sourceEntityId");

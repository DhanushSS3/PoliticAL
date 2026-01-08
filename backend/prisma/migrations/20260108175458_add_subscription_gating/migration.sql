-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "isSubscribed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monitoringEndedAt" TIMESTAMP(3),
ADD COLUMN     "monitoringStartedAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionId" INTEGER;

-- CreateTable
CREATE TABLE "EntityMonitoring" (
    "id" SERIAL NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "triggeredByCandidateId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityMonitoring_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityMonitoring_isActive_idx" ON "EntityMonitoring"("isActive");

-- CreateIndex
CREATE INDEX "EntityMonitoring_reason_idx" ON "EntityMonitoring"("reason");

-- CreateIndex
CREATE INDEX "EntityMonitoring_triggeredByCandidateId_idx" ON "EntityMonitoring"("triggeredByCandidateId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityMonitoring_entityType_entityId_key" ON "EntityMonitoring"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "CandidateProfile_isSubscribed_idx" ON "CandidateProfile"("isSubscribed");

-- CreateIndex
CREATE INDEX "CandidateProfile_monitoringStartedAt_idx" ON "CandidateProfile"("monitoringStartedAt");

-- CreateTable
CREATE TABLE "ConstituencyMarginSummary" (
    "id" SERIAL NOT NULL,
    "geoUnitId" INTEGER NOT NULL,
    "electionId" INTEGER NOT NULL,
    "winningPartyId" INTEGER NOT NULL,
    "runnerUpPartyId" INTEGER NOT NULL,
    "winningVotes" INTEGER NOT NULL,
    "runnerUpVotes" INTEGER NOT NULL,
    "marginVotes" INTEGER NOT NULL,
    "marginPercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConstituencyMarginSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConstituencyMarginSummary_geoUnitId_idx" ON "ConstituencyMarginSummary"("geoUnitId");

-- CreateIndex
CREATE INDEX "ConstituencyMarginSummary_electionId_idx" ON "ConstituencyMarginSummary"("electionId");

-- CreateIndex
CREATE INDEX "ConstituencyMarginSummary_marginVotes_idx" ON "ConstituencyMarginSummary"("marginVotes");

-- CreateIndex
CREATE UNIQUE INDEX "ConstituencyMarginSummary_geoUnitId_electionId_key" ON "ConstituencyMarginSummary"("geoUnitId", "electionId");

-- AddForeignKey
ALTER TABLE "ConstituencyMarginSummary" ADD CONSTRAINT "ConstituencyMarginSummary_geoUnitId_fkey" FOREIGN KEY ("geoUnitId") REFERENCES "GeoUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstituencyMarginSummary" ADD CONSTRAINT "ConstituencyMarginSummary_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstituencyMarginSummary" ADD CONSTRAINT "ConstituencyMarginSummary_winningPartyId_fkey" FOREIGN KEY ("winningPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstituencyMarginSummary" ADD CONSTRAINT "ConstituencyMarginSummary_runnerUpPartyId_fkey" FOREIGN KEY ("runnerUpPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

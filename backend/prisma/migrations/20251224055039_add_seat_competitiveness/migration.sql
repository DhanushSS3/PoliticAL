-- CreateTable
CREATE TABLE "SeatCompetitivenessSummary" (
    "id" SERIAL NOT NULL,
    "geoUnitId" INTEGER NOT NULL,
    "electionId" INTEGER NOT NULL,
    "winningPartyId" INTEGER NOT NULL,
    "marginPercent" DOUBLE PRECISION NOT NULL,
    "classification" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatCompetitivenessSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeatCompetitivenessSummary_classification_idx" ON "SeatCompetitivenessSummary"("classification");

-- CreateIndex
CREATE INDEX "SeatCompetitivenessSummary_electionId_idx" ON "SeatCompetitivenessSummary"("electionId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatCompetitivenessSummary_geoUnitId_electionId_key" ON "SeatCompetitivenessSummary"("geoUnitId", "electionId");

-- AddForeignKey
ALTER TABLE "SeatCompetitivenessSummary" ADD CONSTRAINT "SeatCompetitivenessSummary_geoUnitId_fkey" FOREIGN KEY ("geoUnitId") REFERENCES "GeoUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatCompetitivenessSummary" ADD CONSTRAINT "SeatCompetitivenessSummary_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatCompetitivenessSummary" ADD CONSTRAINT "SeatCompetitivenessSummary_winningPartyId_fkey" FOREIGN KEY ("winningPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

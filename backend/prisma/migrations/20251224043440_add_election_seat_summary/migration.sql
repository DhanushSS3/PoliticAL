-- CreateTable
CREATE TABLE "ElectionSeatSummary" (
    "id" SERIAL NOT NULL,
    "electionId" INTEGER NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "majorityMark" INTEGER NOT NULL,
    "winningPartyId" INTEGER,
    "isHungAssembly" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionSeatSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ElectionSeatSummary_electionId_key" ON "ElectionSeatSummary"("electionId");

-- CreateIndex
CREATE INDEX "ElectionSeatSummary_winningPartyId_idx" ON "ElectionSeatSummary"("winningPartyId");

-- AddForeignKey
ALTER TABLE "ElectionSeatSummary" ADD CONSTRAINT "ElectionSeatSummary_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionSeatSummary" ADD CONSTRAINT "ElectionSeatSummary_winningPartyId_fkey" FOREIGN KEY ("winningPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

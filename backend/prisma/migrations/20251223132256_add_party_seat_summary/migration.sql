-- CreateTable
CREATE TABLE "PartySeatSummary" (
    "id" SERIAL NOT NULL,
    "electionId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "seatsWon" INTEGER NOT NULL,

    CONSTRAINT "PartySeatSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartySeatSummary_electionId_partyId_key" ON "PartySeatSummary"("electionId", "partyId");

-- AddForeignKey
ALTER TABLE "PartySeatSummary" ADD CONSTRAINT "PartySeatSummary_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartySeatSummary" ADD CONSTRAINT "PartySeatSummary_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

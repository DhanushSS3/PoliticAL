-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "opponentProfilePhotoPath" TEXT,
ADD COLUMN     "opponentProfileTextPath" TEXT,
ADD COLUMN     "profilePhotoPath" TEXT,
ADD COLUMN     "profileTextPath" TEXT;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

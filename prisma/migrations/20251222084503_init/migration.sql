-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SUBSCRIBER');

-- CreateEnum
CREATE TYPE "GeoLevel" AS ENUM ('STATE', 'DISTRICT', 'CONSTITUENCY', 'WARD', 'BOOTH');

-- CreateEnum
CREATE TYPE "ElectionType" AS ENUM ('ASSEMBLY', 'PARLIAMENT', 'MUNICIPAL');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SentimentLabel" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('NEWS', 'ANALYST');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "GeoUnit" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "level" "GeoLevel" NOT NULL,
    "parentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "colorHex" TEXT,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "gender" TEXT,
    "age" INTEGER,
    "category" TEXT,
    "partyId" INTEGER NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Election" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "type" "ElectionType" NOT NULL,
    "stateId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionResultRaw" (
    "id" SERIAL NOT NULL,
    "electionId" INTEGER NOT NULL,
    "geoUnitId" INTEGER NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "votesGeneral" INTEGER NOT NULL,
    "votesPostal" INTEGER NOT NULL,
    "votesTotal" INTEGER NOT NULL,

    CONSTRAINT "ElectionResultRaw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoElectionSummary" (
    "id" SERIAL NOT NULL,
    "electionId" INTEGER NOT NULL,
    "geoUnitId" INTEGER NOT NULL,
    "totalElectors" INTEGER NOT NULL,
    "totalVotesCast" INTEGER NOT NULL,
    "turnoutPercent" DOUBLE PRECISION NOT NULL,
    "winningParty" TEXT NOT NULL,
    "winningCandidate" TEXT NOT NULL,
    "winningMargin" INTEGER NOT NULL,
    "winningMarginPct" DOUBLE PRECISION NOT NULL,
    "notaVotes" INTEGER NOT NULL,
    "notaPercent" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "GeoElectionSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyVoteSummary" (
    "id" SERIAL NOT NULL,
    "geoElectionSummaryId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "voteCount" INTEGER NOT NULL,
    "voteSharePercent" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PartyVoteSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoAccess" (
    "id" INTEGER NOT NULL,
    "subscriptionId" INTEGER NOT NULL,
    "geoUnitId" INTEGER NOT NULL,

    CONSTRAINT "GeoAccess_pkey" PRIMARY KEY ("subscriptionId","geoUnitId")
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentimentSignal" (
    "id" SERIAL NOT NULL,
    "geoUnitId" INTEGER NOT NULL,
    "sourceType" "DataSourceType" NOT NULL,
    "sourceRefId" INTEGER NOT NULL,
    "sentiment" "SentimentLabel" NOT NULL,
    "sentimentScore" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentimentSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyGeoStats" (
    "id" SERIAL NOT NULL,
    "geoUnitId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "avgSentiment" DOUBLE PRECISION NOT NULL,
    "pulseScore" DOUBLE PRECISION NOT NULL,
    "dominantIssue" TEXT,

    CONSTRAINT "DailyGeoStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "geoUnitId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" SERIAL NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "errorLog" TEXT,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeoUnit_parentId_idx" ON "GeoUnit"("parentId");

-- CreateIndex
CREATE INDEX "GeoUnit_level_idx" ON "GeoUnit"("level");

-- CreateIndex
CREATE INDEX "GeoUnit_code_idx" ON "GeoUnit"("code");

-- CreateIndex
CREATE INDEX "Party_name_idx" ON "Party"("name");

-- CreateIndex
CREATE INDEX "Candidate_partyId_idx" ON "Candidate"("partyId");

-- CreateIndex
CREATE INDEX "Election_year_type_idx" ON "Election"("year", "type");

-- CreateIndex
CREATE INDEX "ElectionResultRaw_electionId_geoUnitId_idx" ON "ElectionResultRaw"("electionId", "geoUnitId");

-- CreateIndex
CREATE INDEX "ElectionResultRaw_candidateId_idx" ON "ElectionResultRaw"("candidateId");

-- CreateIndex
CREATE INDEX "ElectionResultRaw_partyId_idx" ON "ElectionResultRaw"("partyId");

-- CreateIndex
CREATE INDEX "GeoElectionSummary_geoUnitId_idx" ON "GeoElectionSummary"("geoUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "GeoElectionSummary_electionId_geoUnitId_key" ON "GeoElectionSummary"("electionId", "geoUnitId");

-- CreateIndex
CREATE INDEX "PartyVoteSummary_geoElectionSummaryId_idx" ON "PartyVoteSummary"("geoElectionSummaryId");

-- CreateIndex
CREATE INDEX "PartyVoteSummary_partyId_idx" ON "PartyVoteSummary"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_startsAt_endsAt_idx" ON "Subscription"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "GeoAccess_geoUnitId_idx" ON "GeoAccess"("geoUnitId");

-- CreateIndex
CREATE INDEX "NewsArticle_status_idx" ON "NewsArticle"("status");

-- CreateIndex
CREATE INDEX "NewsArticle_publishedAt_idx" ON "NewsArticle"("publishedAt");

-- CreateIndex
CREATE INDEX "SentimentSignal_geoUnitId_createdAt_idx" ON "SentimentSignal"("geoUnitId", "createdAt");

-- CreateIndex
CREATE INDEX "SentimentSignal_sourceType_idx" ON "SentimentSignal"("sourceType");

-- CreateIndex
CREATE INDEX "DailyGeoStats_date_idx" ON "DailyGeoStats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyGeoStats_geoUnitId_date_key" ON "DailyGeoStats"("geoUnitId", "date");

-- CreateIndex
CREATE INDEX "Alert_userId_isRead_idx" ON "Alert"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "Job_jobType_status_idx" ON "Job"("jobType", "status");

-- CreateIndex
CREATE INDEX "Job_startedAt_idx" ON "Job"("startedAt");

-- AddForeignKey
ALTER TABLE "GeoUnit" ADD CONSTRAINT "GeoUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GeoUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionResultRaw" ADD CONSTRAINT "ElectionResultRaw_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionResultRaw" ADD CONSTRAINT "ElectionResultRaw_geoUnitId_fkey" FOREIGN KEY ("geoUnitId") REFERENCES "GeoUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionResultRaw" ADD CONSTRAINT "ElectionResultRaw_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionResultRaw" ADD CONSTRAINT "ElectionResultRaw_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoElectionSummary" ADD CONSTRAINT "GeoElectionSummary_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoElectionSummary" ADD CONSTRAINT "GeoElectionSummary_geoUnitId_fkey" FOREIGN KEY ("geoUnitId") REFERENCES "GeoUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyVoteSummary" ADD CONSTRAINT "PartyVoteSummary_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyVoteSummary" ADD CONSTRAINT "PartyVoteSummary_geoElectionSummaryId_fkey" FOREIGN KEY ("geoElectionSummaryId") REFERENCES "GeoElectionSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoAccess" ADD CONSTRAINT "GeoAccess_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoAccess" ADD CONSTRAINT "GeoAccess_geoUnitId_fkey" FOREIGN KEY ("geoUnitId") REFERENCES "GeoUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentimentSignal" ADD CONSTRAINT "SentimentSignal_geoUnitId_fkey" FOREIGN KEY ("geoUnitId") REFERENCES "GeoUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentimentSignal" ADD CONSTRAINT "SentimentSignal_sourceRefId_fkey" FOREIGN KEY ("sourceRefId") REFERENCES "NewsArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyGeoStats" ADD CONSTRAINT "DailyGeoStats_geoUnitId_fkey" FOREIGN KEY ("geoUnitId") REFERENCES "GeoUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

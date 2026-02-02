-- CreateEnum
CREATE TYPE "Religion" AS ENUM ('HINDU', 'MUSLIM', 'CHRISTIAN', 'SIKH', 'BUDDHIST', 'JAIN', 'OTHER', 'NOT_STATED');

-- CreateTable
CREATE TABLE "GeoReligionStat" (
    "id" SERIAL NOT NULL,
    "geoUnitId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "religion" "Religion" NOT NULL,
    "population" INTEGER NOT NULL,
    "percent" DOUBLE PRECISION,

    CONSTRAINT "GeoReligionStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeoReligionStat_geoUnitId_year_idx" ON "GeoReligionStat"("geoUnitId", "year");

-- CreateIndex
CREATE INDEX "GeoReligionStat_religion_idx" ON "GeoReligionStat"("religion");

-- CreateIndex
CREATE UNIQUE INDEX "GeoReligionStat_geoUnitId_year_religion_key" ON "GeoReligionStat"("geoUnitId", "year", "religion");

-- AddForeignKey
ALTER TABLE "GeoReligionStat" ADD CONSTRAINT "GeoReligionStat_geoUnitId_fkey" FOREIGN KEY ("geoUnitId") REFERENCES "GeoUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

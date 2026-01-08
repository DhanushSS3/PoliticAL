import { PrismaService } from "../../../prisma/prisma.service";
export declare class DailyGeoStatsService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    computeDailyStats(): Promise<void>;
    computeStatsForGeoUnit(geoUnitId: number, date?: Date): Promise<void>;
    private calculateAverageSentiment;
    private calculatePulseScore;
    private extractDominantIssue;
    getDailyStats(geoUnitId: number, days?: number): Promise<{
        id: number;
        date: Date;
        geoUnitId: number;
        pulseScore: number;
        avgSentiment: number;
        dominantIssue: string | null;
    }[]>;
}

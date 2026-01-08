import { CandidatePulseService } from "./services/candidate-pulse.service";
import { AlertService } from "./services/alert.service";
import { GetPulseDto, GetTrendDto } from "./dto/analytics.dto";
import { DailyGeoStatsService } from "./services/daily-geo-stats.service";
export declare class AnalyticsController {
    private readonly pulseService;
    private readonly alertService;
    private readonly dailyGeoStatsService;
    constructor(pulseService: CandidatePulseService, alertService: AlertService, dailyGeoStatsService: DailyGeoStatsService);
    getCandidatePulse(id: number, dto: GetPulseDto): Promise<import("./interfaces/pulse-data.interface").PulseData>;
    getCandidateTrend(id: number, dto: GetTrendDto): Promise<{
        date: string;
        pulseScore: number;
    }[]>;
    triggerAlerts(): Promise<{
        message: string;
    }>;
    getDailyStats(geoUnitId: number, days?: string): Promise<{
        id: number;
        date: Date;
        geoUnitId: number;
        pulseScore: number;
        avgSentiment: number;
        dominantIssue: string | null;
    }[]>;
}

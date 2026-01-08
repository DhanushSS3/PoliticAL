import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { CandidatePulseService } from "./services/candidate-pulse.service";
import { AlertService } from "./services/alert.service";
import { GetPulseDto, GetTrendDto } from "./dto/analytics.dto";
import { DailyGeoStatsService } from "./services/daily-geo-stats.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly pulseService: CandidatePulseService,
    private readonly alertService: AlertService,
    private readonly dailyGeoStatsService: DailyGeoStatsService,
  ) {}

  /**
   * GET /api/analytics/candidate/:id/pulse
   * Get pulse score for a candidate
   *
   * @param id - Candidate ID
   * @param dto - Query params (days)
   * @returns PulseData
   */
  @Get("candidate/:id/pulse")
  async getCandidatePulse(
    @Param("id", ParseIntPipe) id: number,
    @Query() dto: GetPulseDto,
  ) {
    return this.pulseService.calculatePulse(id, dto.days);
  }

  /**
   * GET /api/analytics/candidate/:id/trend
   * Get time-series pulse data for charting
   *
   * @param id - Candidate ID
   * @param dto - Query params (days)
   * @returns Array of {date, pulseScore}
   */
  @Get("candidate/:id/trend")
  async getCandidateTrend(
    @Param("id", ParseIntPipe) id: number,
    @Query() dto: GetTrendDto,
  ) {
    return this.pulseService.getPulseTrend(id, dto.days);
  }

  /**
   * POST /api/analytics/alerts/trigger
   * Manually trigger alert detection (for testing)
   */
  @Post("alerts/trigger")
  async triggerAlerts() {
    await this.alertService.triggerAlertDetection();
    return { message: "Alert detection triggered" };
  }

  /**
   * GET /api/analytics/daily-stats/:geoUnitId
   * Get daily stats (sentiment, dominant issue) for a geo unit
   */
  @Get("daily-stats/:geoUnitId")
  async getDailyStats(
    @Param("geoUnitId", ParseIntPipe) geoUnitId: number,
    @Query("days") days?: string,
  ) {
    const daysCount = days ? parseInt(days) : 30;
    return this.dailyGeoStatsService.getDailyStats(geoUnitId, daysCount);
  }
}

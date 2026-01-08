import { Module } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";
import { SubscriptionController } from "./controllers/subscription.controller";
import { RelevanceCalculatorService } from "./services/relevance-calculator.service";
import { CandidatePulseService } from "./services/candidate-pulse.service";
import { AlertService } from "./services/alert.service";
import { MonitoringManagerService } from "./services/monitoring-manager.service";
import { DailyGeoStatsService } from "./services/daily-geo-stats.service";
import { NewsModule } from "../news/news.module";

@Module({
  imports: [NewsModule],
  providers: [
    AnalyticsService,
    CandidatePulseService,
    AlertService,
    MonitoringManagerService,
    DailyGeoStatsService,
  ],
  controllers: [AnalyticsController, SubscriptionController],
  exports: [
    AnalyticsService,
    CandidatePulseService,
    AlertService,
    MonitoringManagerService,
  ],
})
export class AnalyticsModule { }

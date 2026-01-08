import { Module } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";
import { RelevanceCalculatorService } from "./services/relevance-calculator.service";
import { CandidatePulseService } from "./services/candidate-pulse.service";
import { AlertService } from "./services/alert.service";

@Module({
  providers: [
    AnalyticsService,
    RelevanceCalculatorService,
    CandidatePulseService,
    AlertService,
  ],
  controllers: [AnalyticsController],
  exports: [
    AnalyticsService,
    RelevanceCalculatorService,
    CandidatePulseService,
    AlertService,
  ],
})
export class AnalyticsModule { }

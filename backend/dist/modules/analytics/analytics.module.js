"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsModule = void 0;
const common_1 = require("@nestjs/common");
const analytics_service_1 = require("./analytics.service");
const analytics_controller_1 = require("./analytics.controller");
const subscription_controller_1 = require("./controllers/subscription.controller");
const candidate_pulse_service_1 = require("./services/candidate-pulse.service");
const alert_service_1 = require("./services/alert.service");
const monitoring_manager_service_1 = require("./services/monitoring-manager.service");
const daily_geo_stats_service_1 = require("./services/daily-geo-stats.service");
const news_module_1 = require("../news/news.module");
let AnalyticsModule = class AnalyticsModule {
};
exports.AnalyticsModule = AnalyticsModule;
exports.AnalyticsModule = AnalyticsModule = __decorate([
    (0, common_1.Module)({
        imports: [news_module_1.NewsModule],
        providers: [
            analytics_service_1.AnalyticsService,
            candidate_pulse_service_1.CandidatePulseService,
            alert_service_1.AlertService,
            monitoring_manager_service_1.MonitoringManagerService,
            daily_geo_stats_service_1.DailyGeoStatsService,
        ],
        controllers: [analytics_controller_1.AnalyticsController, subscription_controller_1.SubscriptionController],
        exports: [
            analytics_service_1.AnalyticsService,
            candidate_pulse_service_1.CandidatePulseService,
            alert_service_1.AlertService,
            monitoring_manager_service_1.MonitoringManagerService,
        ],
    })
], AnalyticsModule);
//# sourceMappingURL=analytics.module.js.map
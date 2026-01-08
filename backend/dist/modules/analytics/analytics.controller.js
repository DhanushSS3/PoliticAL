"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const candidate_pulse_service_1 = require("./services/candidate-pulse.service");
const alert_service_1 = require("./services/alert.service");
const analytics_dto_1 = require("./dto/analytics.dto");
const daily_geo_stats_service_1 = require("./services/daily-geo-stats.service");
let AnalyticsController = class AnalyticsController {
    constructor(pulseService, alertService, dailyGeoStatsService) {
        this.pulseService = pulseService;
        this.alertService = alertService;
        this.dailyGeoStatsService = dailyGeoStatsService;
    }
    async getCandidatePulse(id, dto) {
        return this.pulseService.calculatePulse(id, dto.days);
    }
    async getCandidateTrend(id, dto) {
        return this.pulseService.getPulseTrend(id, dto.days);
    }
    async triggerAlerts() {
        await this.alertService.triggerAlertDetection();
        return { message: "Alert detection triggered" };
    }
    async getDailyStats(geoUnitId, days) {
        const daysCount = days ? parseInt(days) : 30;
        return this.dailyGeoStatsService.getDailyStats(geoUnitId, daysCount);
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, common_1.Get)("candidate/:id/pulse"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, analytics_dto_1.GetPulseDto]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getCandidatePulse", null);
__decorate([
    (0, common_1.Get)("candidate/:id/trend"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, analytics_dto_1.GetTrendDto]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getCandidateTrend", null);
__decorate([
    (0, common_1.Post)("alerts/trigger"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "triggerAlerts", null);
__decorate([
    (0, common_1.Get)("daily-stats/:geoUnitId"),
    __param(0, (0, common_1.Param)("geoUnitId", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)("days")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], AnalyticsController.prototype, "getDailyStats", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, common_1.Controller)("analytics"),
    __metadata("design:paramtypes", [candidate_pulse_service_1.CandidatePulseService,
        alert_service_1.AlertService,
        daily_geo_stats_service_1.DailyGeoStatsService])
], AnalyticsController);
//# sourceMappingURL=analytics.controller.js.map
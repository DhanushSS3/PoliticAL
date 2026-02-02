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
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const dashboard_service_1 = require("./dashboard.service");
const session_guard_1 = require("../auth/guards/session.guard");
const geo_access_guard_1 = require("../auth/guards/geo-access.guard");
let DashboardController = class DashboardController {
    constructor(dashboardService) {
        this.dashboardService = dashboardService;
    }
    async getSummary(electionId, stateId, someIntParam) {
        return this.dashboardService.getSummary(electionId);
    }
    async getPartyStats(electionId) {
        return this.dashboardService.getPartyStats(electionId);
    }
    async getHistoricalStats() {
        return this.dashboardService.getHistoricalStats();
    }
    async getReligionDistribution(geoUnitId, year) {
        return this.dashboardService.getReligionDistribution(geoUnitId, year);
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, common_1.Query)('electionId')),
    __param(1, (0, common_1.Query)('stateId')),
    __param(2, (0, common_1.Query)('someIntParam', new common_1.ParseIntPipe({ optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Number]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)('party-stats'),
    __param(0, (0, common_1.Query)('electionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getPartyStats", null);
__decorate([
    (0, common_1.Get)('historical-stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getHistoricalStats", null);
__decorate([
    (0, common_1.Get)('religion-distribution'),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard, geo_access_guard_1.GeoAccessGuard),
    __param(0, (0, common_1.Query)('geoUnitId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('year', new common_1.ParseIntPipe({ optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], DashboardController.prototype, "getReligionDistribution", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)('v1/dashboard'),
    __metadata("design:paramtypes", [dashboard_service_1.DashboardService])
], DashboardController);
//# sourceMappingURL=dashboard.controller.js.map
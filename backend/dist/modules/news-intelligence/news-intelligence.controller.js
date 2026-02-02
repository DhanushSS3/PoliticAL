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
exports.NewsIntelligenceController = void 0;
const common_1 = require("@nestjs/common");
const news_intelligence_service_1 = require("./news-intelligence.service");
const session_guard_1 = require("../auth/guards/session.guard");
let NewsIntelligenceController = class NewsIntelligenceController {
    constructor(newsIntelligenceService) {
        this.newsIntelligenceService = newsIntelligenceService;
    }
    async getProjectedWinner(req, geoUnitId) {
        return this.newsIntelligenceService.getProjectedWinner(geoUnitId, req.user.id);
    }
    async getControversies(req, geoUnitId, days, limit) {
        return this.newsIntelligenceService.getControversies(geoUnitId, days || 7, limit || 5, req.user.id);
    }
    async getHeadToHead(req, candidate1Id, candidate2Id, days) {
        return this.newsIntelligenceService.getHeadToHead(candidate1Id, candidate2Id, days || 30, req.user.id);
    }
    async getNewsImpact(req, geoUnitId, days) {
        return this.newsIntelligenceService.getNewsImpact(geoUnitId, days || 7, req.user.id);
    }
    async getLiveFeed(req, geoUnitId, partyId, limit) {
        return this.newsIntelligenceService.getLiveFeed(geoUnitId, partyId, limit || 20, req.user.id);
    }
    async getDashboardSentiment(days) {
        return this.newsIntelligenceService.getDashboardSentiment(days || 7);
    }
    async getDashboardNewsImpact(days, partyLimit) {
        return this.newsIntelligenceService.getDashboardNewsImpact(days || 7, partyLimit || 3);
    }
};
exports.NewsIntelligenceController = NewsIntelligenceController;
__decorate([
    (0, common_1.Get)('projected-winner'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('geoUnitId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NewsIntelligenceController.prototype, "getProjectedWinner", null);
__decorate([
    (0, common_1.Get)('controversies'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('geoUnitId')),
    __param(2, (0, common_1.Query)('days', new common_1.ParseIntPipe({ optional: true }))),
    __param(3, (0, common_1.Query)('limit', new common_1.ParseIntPipe({ optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number, Number]),
    __metadata("design:returntype", Promise)
], NewsIntelligenceController.prototype, "getControversies", null);
__decorate([
    (0, common_1.Get)('head-to-head'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('candidate1Id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('candidate2Id', common_1.ParseIntPipe)),
    __param(3, (0, common_1.Query)('days', new common_1.ParseIntPipe({ optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number, Number]),
    __metadata("design:returntype", Promise)
], NewsIntelligenceController.prototype, "getHeadToHead", null);
__decorate([
    (0, common_1.Get)('news-impact'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('geoUnitId')),
    __param(2, (0, common_1.Query)('days', new common_1.ParseIntPipe({ optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number]),
    __metadata("design:returntype", Promise)
], NewsIntelligenceController.prototype, "getNewsImpact", null);
__decorate([
    (0, common_1.Get)('live-feed'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('geoUnitId')),
    __param(2, (0, common_1.Query)('partyId', new common_1.ParseIntPipe({ optional: true }))),
    __param(3, (0, common_1.Query)('limit', new common_1.ParseIntPipe({ optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number, Number]),
    __metadata("design:returntype", Promise)
], NewsIntelligenceController.prototype, "getLiveFeed", null);
__decorate([
    (0, common_1.Get)('dashboard-sentiment'),
    __param(0, (0, common_1.Query)('days', new common_1.ParseIntPipe({ optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], NewsIntelligenceController.prototype, "getDashboardSentiment", null);
__decorate([
    (0, common_1.Get)('dashboard-news-impact'),
    __param(0, (0, common_1.Query)('days', new common_1.ParseIntPipe({ optional: true }))),
    __param(1, (0, common_1.Query)('partyLimit', new common_1.ParseIntPipe({ optional: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], NewsIntelligenceController.prototype, "getDashboardNewsImpact", null);
exports.NewsIntelligenceController = NewsIntelligenceController = __decorate([
    (0, common_1.Controller)('v1/news-intelligence'),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard),
    __metadata("design:paramtypes", [news_intelligence_service_1.NewsIntelligenceService])
], NewsIntelligenceController);
//# sourceMappingURL=news-intelligence.controller.js.map
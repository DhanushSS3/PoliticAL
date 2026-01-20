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
exports.AdminNewsQueueController = void 0;
const common_1 = require("@nestjs/common");
const session_guard_1 = require("../auth/guards/session.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const news_queue_scheduler_service_1 = require("./services/news-queue-scheduler.service");
let AdminNewsQueueController = class AdminNewsQueueController {
    constructor(queueScheduler) {
        this.queueScheduler = queueScheduler;
    }
    async getQueueStats() {
        const stats = await this.queueScheduler.getQueueStats();
        return {
            success: true,
            data: stats,
        };
    }
    async triggerGoogleNews(entityType, entityId) {
        await this.queueScheduler.triggerGoogleNewsNow(entityType, parseInt(entityId, 10));
        return {
            success: true,
            message: `Google News ingestion triggered for ${entityType} #${entityId}`,
        };
    }
    async triggerRssFeeds() {
        await this.queueScheduler.triggerRssFeedNow();
        return {
            success: true,
            message: 'RSS feed ingestion triggered',
        };
    }
    async triggerGoogleNewsAll() {
        await this.queueScheduler.scheduleGoogleNewsIngestion();
        return {
            success: true,
            message: 'Google News ingestion scheduled for all active entities',
        };
    }
};
exports.AdminNewsQueueController = AdminNewsQueueController;
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminNewsQueueController.prototype, "getQueueStats", null);
__decorate([
    (0, common_1.Post)('trigger/google-news/:entityType/:entityId'),
    __param(0, (0, common_1.Param)('entityType')),
    __param(1, (0, common_1.Param)('entityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminNewsQueueController.prototype, "triggerGoogleNews", null);
__decorate([
    (0, common_1.Post)('trigger/rss-feeds'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminNewsQueueController.prototype, "triggerRssFeeds", null);
__decorate([
    (0, common_1.Post)('trigger/google-news-all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminNewsQueueController.prototype, "triggerGoogleNewsAll", null);
exports.AdminNewsQueueController = AdminNewsQueueController = __decorate([
    (0, common_1.Controller)('v1/admin/news-queue'),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __metadata("design:paramtypes", [news_queue_scheduler_service_1.NewsQueueSchedulerService])
], AdminNewsQueueController);
//# sourceMappingURL=admin-news-queue.controller.js.map
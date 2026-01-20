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
var NewsQueueSchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsQueueSchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("../../../prisma/prisma.service");
const queue_config_1 = require("../config/queue.config");
let NewsQueueSchedulerService = NewsQueueSchedulerService_1 = class NewsQueueSchedulerService {
    constructor(prisma, googleNewsQueue, rssFeedQueue) {
        this.prisma = prisma;
        this.googleNewsQueue = googleNewsQueue;
        this.rssFeedQueue = rssFeedQueue;
        this.logger = new common_1.Logger(NewsQueueSchedulerService_1.name);
    }
    async scheduleGoogleNewsIngestion() {
        this.logger.log('📅 Scheduling Google News ingestion jobs...');
        try {
            const activeEntities = await this.prisma.entityMonitoring.findMany({
                where: { isActive: true },
                select: {
                    entityType: true,
                    entityId: true,
                    priority: true,
                },
            });
            if (activeEntities.length === 0) {
                this.logger.warn('No active entities to monitor');
                return;
            }
            this.logger.log(`Adding ${activeEntities.length} jobs to Google News queue`);
            const jobs = activeEntities.map((entity) => ({
                name: `google-news-${entity.entityType}-${entity.entityId}`,
                data: {
                    entityType: entity.entityType,
                    entityId: entity.entityId,
                    priority: entity.priority,
                },
                opts: {
                    priority: 10 - entity.priority,
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 5000,
                    },
                    removeOnComplete: 100,
                    removeOnFail: 50,
                },
            }));
            await this.googleNewsQueue.addBulk(jobs);
            this.logger.log(`✅ Added ${jobs.length} Google News jobs to queue`);
        }
        catch (error) {
            this.logger.error(`Failed to schedule Google News jobs: ${error.message}`);
        }
    }
    async scheduleRssFeedIngestion() {
        this.logger.log('📅 Scheduling RSS feed ingestion job...');
        try {
            await this.rssFeedQueue.add('rss-feed-all-sources', {
                priority: 8,
            }, {
                priority: 2,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 10000,
                },
                removeOnComplete: 50,
                removeOnFail: 25,
            });
            this.logger.log('✅ Added RSS feed job to queue');
        }
        catch (error) {
            this.logger.error(`Failed to schedule RSS feed job: ${error.message}`);
        }
    }
    async triggerGoogleNewsNow(entityType, entityId) {
        this.logger.log(`Manually triggering Google News for ${entityType} #${entityId}`);
        await this.googleNewsQueue.add(`manual-google-news-${entityType}-${entityId}`, {
            entityType,
            entityId,
            priority: 10,
        }, {
            priority: 1,
            attempts: 1,
        });
    }
    async triggerRssFeedNow() {
        this.logger.log('Manually triggering RSS feed ingestion');
        await this.rssFeedQueue.add('manual-rss-feed', {
            priority: 10,
        }, {
            priority: 1,
            attempts: 1,
        });
    }
    async getQueueStats() {
        const googleNewsStats = {
            waiting: await this.googleNewsQueue.getWaitingCount(),
            active: await this.googleNewsQueue.getActiveCount(),
            completed: await this.googleNewsQueue.getCompletedCount(),
            failed: await this.googleNewsQueue.getFailedCount(),
        };
        const rssFeedStats = {
            waiting: await this.rssFeedQueue.getWaitingCount(),
            active: await this.rssFeedQueue.getActiveCount(),
            completed: await this.rssFeedQueue.getCompletedCount(),
            failed: await this.rssFeedQueue.getFailedCount(),
        };
        return {
            googleNews: googleNewsStats,
            rssFeed: rssFeedStats,
        };
    }
};
exports.NewsQueueSchedulerService = NewsQueueSchedulerService;
__decorate([
    (0, schedule_1.Cron)('*/30 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NewsQueueSchedulerService.prototype, "scheduleGoogleNewsIngestion", null);
__decorate([
    (0, schedule_1.Cron)('0 */2 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NewsQueueSchedulerService.prototype, "scheduleRssFeedIngestion", null);
exports.NewsQueueSchedulerService = NewsQueueSchedulerService = NewsQueueSchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, bullmq_1.InjectQueue)(queue_config_1.NEWS_QUEUES.GOOGLE_NEWS)),
    __param(2, (0, bullmq_1.InjectQueue)(queue_config_1.NEWS_QUEUES.RSS_FEEDS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bullmq_2.Queue,
        bullmq_2.Queue])
], NewsQueueSchedulerService);
//# sourceMappingURL=news-queue-scheduler.service.js.map
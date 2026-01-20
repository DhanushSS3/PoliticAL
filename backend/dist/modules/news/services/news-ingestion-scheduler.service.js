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
var NewsIngestionSchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsIngestionSchedulerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const news_ingestion_service_1 = require("./news-ingestion.service");
let NewsIngestionSchedulerService = NewsIngestionSchedulerService_1 = class NewsIngestionSchedulerService {
    constructor(prisma, newsIngestion) {
        this.prisma = prisma;
        this.newsIngestion = newsIngestion;
        this.logger = new common_1.Logger(NewsIngestionSchedulerService_1.name);
    }
    async scheduleTier1() {
        this.logger.log("🕒 Starting TIER 1 news ingestion (Priority >= 8)...");
        await this.runIngestionForTier(8, 10);
    }
    async scheduleTier2() {
        this.logger.log("🕒 Starting TIER 2 news ingestion (Priority 5-7)...");
        await this.runIngestionForTier(5, 7);
    }
    async scheduleTier3() {
        this.logger.log("🕒 Starting TIER 3 news ingestion (Priority <= 4)...");
        await this.runIngestionForTier(0, 4);
    }
    async runIngestionForTier(minPriority, maxPriority) {
        try {
            const entities = await this.prisma.entityMonitoring.findMany({
                where: {
                    isActive: true,
                    priority: {
                        gte: minPriority,
                        lte: maxPriority,
                    },
                },
                select: {
                    entityType: true,
                    entityId: true,
                    priority: true,
                },
            });
            if (entities.length === 0) {
                this.logger.debug(`No active entities found for priority range ${minPriority}-${maxPriority}`);
                return;
            }
            this.logger.log(`Found ${entities.length} entities for priority range ${minPriority}-${maxPriority}`);
            for (const entity of entities) {
                try {
                    await this.newsIngestion.fetchNewsForEntity(entity.entityType, entity.entityId);
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
                catch (err) {
                    this.logger.error(`Failed to ingest for ${entity.entityType} #${entity.entityId}: ${err.message}`);
                }
            }
            this.logger.log(`✅ Completed ingestion for priority range ${minPriority}-${maxPriority}`);
        }
        catch (error) {
            this.logger.error(`Error in scheduler for range ${minPriority}-${maxPriority}: ${error.message}`);
        }
    }
};
exports.NewsIngestionSchedulerService = NewsIngestionSchedulerService;
exports.NewsIngestionSchedulerService = NewsIngestionSchedulerService = NewsIngestionSchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        news_ingestion_service_1.NewsIngestionService])
], NewsIngestionSchedulerService);
//# sourceMappingURL=news-ingestion-scheduler.service.js.map
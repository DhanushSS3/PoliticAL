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
var DailyGeoStatsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyGeoStatsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../../prisma/prisma.service");
const issue_keywords_1 = require("../data/issue-keywords");
let DailyGeoStatsService = DailyGeoStatsService_1 = class DailyGeoStatsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(DailyGeoStatsService_1.name);
    }
    async computeDailyStats() {
        this.logger.log("Starting nightly DailyGeoStats computation...");
        const jobStart = new Date();
        try {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const activeGeoUnitIds = await this.prisma.sentimentSignal.findMany({
                where: {
                    createdAt: { gte: startOfDay },
                },
                select: { geoUnitId: true },
                distinct: ["geoUnitId"],
            });
            this.logger.log(`Found ${activeGeoUnitIds.length} GeoUnits with activity today`);
            let processed = 0;
            for (const { geoUnitId } of activeGeoUnitIds) {
                await this.computeStatsForGeoUnit(geoUnitId, startOfDay);
                processed++;
                if (processed % 50 === 0) {
                    this.logger.debug(`Processed ${processed}/${activeGeoUnitIds.length} active GeoUnits`);
                }
            }
            this.logger.log(`✅ Daily stats completed. Processed ${processed} GeoUnits.`);
        }
        catch (error) {
            this.logger.error(`Failed to compute daily stats: ${error.message}`);
        }
    }
    async computeStatsForGeoUnit(geoUnitId, date = new Date()) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        const signals = await this.prisma.sentimentSignal.findMany({
            where: {
                geoUnitId,
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            include: {
                newsArticle: true,
            },
        });
        if (signals.length === 0)
            return;
        const avgSentiment = this.calculateAverageSentiment(signals);
        const pulseScore = this.calculatePulseScore(signals);
        const dominantIssue = this.extractDominantIssue(signals);
        await this.prisma.dailyGeoStats.upsert({
            where: {
                geoUnitId_date: {
                    geoUnitId,
                    date: startOfDay,
                },
            },
            create: {
                geoUnitId,
                date: startOfDay,
                avgSentiment,
                pulseScore,
                dominantIssue,
            },
            update: {
                avgSentiment,
                pulseScore,
                dominantIssue,
            },
        });
    }
    calculateAverageSentiment(signals) {
        if (signals.length === 0)
            return 0;
        const sum = signals.reduce((acc, s) => acc + s.sentimentScore, 0);
        return parseFloat((sum / signals.length).toFixed(2));
    }
    calculatePulseScore(signals) {
        if (signals.length === 0)
            return 0;
        const sum = signals.reduce((acc, s) => {
            const weight = s.relevanceWeight || 1.0;
            return acc + s.sentimentScore * s.confidence * weight;
        }, 0);
        return parseFloat((sum / signals.length).toFixed(2));
    }
    extractDominantIssue(signals) {
        const uniqueArticles = new Map();
        for (const signal of signals) {
            if (signal.newsArticle) {
                uniqueArticles.set(signal.newsArticle.id, `${signal.newsArticle.title} ${signal.newsArticle.summary}`);
            }
        }
        if (uniqueArticles.size === 0)
            return null;
        const allText = Array.from(uniqueArticles.values()).join(" ").toLowerCase();
        const scores = {};
        for (const [key, category] of Object.entries(issue_keywords_1.ISSUE_KEYWORDS)) {
            let count = 0;
            for (const keyword of category.keywords) {
                const regex = new RegExp(`\\b${keyword}\\b`, "gi");
                const matches = allText.match(regex);
                if (matches) {
                    count += matches.length;
                }
            }
            scores[category.label] = count * category.weight;
        }
        let maxScore = 0;
        let dominantLabel = null;
        for (const [label, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                dominantLabel = label;
            }
        }
        return dominantLabel;
    }
    async getDailyStats(geoUnitId, days = 30) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        return this.prisma.dailyGeoStats.findMany({
            where: {
                geoUnitId,
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { date: "asc" },
        });
    }
};
exports.DailyGeoStatsService = DailyGeoStatsService;
__decorate([
    (0, schedule_1.Cron)("59 23 * * *"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DailyGeoStatsService.prototype, "computeDailyStats", null);
exports.DailyGeoStatsService = DailyGeoStatsService = DailyGeoStatsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DailyGeoStatsService);
//# sourceMappingURL=daily-geo-stats.service.js.map
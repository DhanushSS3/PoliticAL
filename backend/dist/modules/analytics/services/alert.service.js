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
var AlertService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../../prisma/prisma.service");
const candidate_pulse_service_1 = require("./candidate-pulse.service");
const client_1 = require("@prisma/client");
let AlertService = AlertService_1 = class AlertService {
    constructor(prisma, pulseService) {
        this.prisma = prisma;
        this.pulseService = pulseService;
        this.logger = new common_1.Logger(AlertService_1.name);
        this.SPIKE_THRESHOLD = 0.35;
        this.SPIKE_MIN_SIGNALS = 3;
        this.SURGE_MIN_COUNT = 3;
        this.SURGE_MIN_CONFIDENCE = 0.8;
        this.HIT_SCORE_THRESHOLD = -0.7;
        this.HIT_CONFIDENCE_THRESHOLD = 0.9;
    }
    async detectAlerts() {
        this.logger.log("Starting hourly alert detection...");
        try {
            const candidates = await this.prisma.candidateProfile.findMany({
                include: {
                    candidate: true,
                    user: true,
                },
            });
            for (const profile of candidates) {
                await this.checkCandidateAlerts(profile.candidateId, profile.userId);
            }
            this.logger.log(`Alert detection completed for ${candidates.length} candidates`);
        }
        catch (error) {
            this.logger.error(`Alert detection failed: ${error.message}`);
        }
    }
    async checkCandidateAlerts(candidateId, userId) {
        if (!userId) {
            return;
        }
        try {
            await this.checkSentimentSpike(candidateId, userId);
            await this.checkNegativeSurge(candidateId, userId);
            await this.checkHighConfidenceHits(candidateId, userId);
        }
        catch (error) {
            this.logger.warn(`Alert check failed for candidate #${candidateId}: ${error.message}`);
        }
    }
    async checkSentimentSpike(candidateId, userId) {
        const todayPulse = await this.pulseService.calculatePulse(candidateId, 1);
        if (todayPulse.articlesAnalyzed < this.SPIKE_MIN_SIGNALS) {
            return;
        }
        const baselinePulse = await this.pulseService.calculatePulse(candidateId, 7);
        const delta = Math.abs(todayPulse.pulseScore - baselinePulse.pulseScore);
        if (delta >= this.SPIKE_THRESHOLD) {
            const direction = todayPulse.pulseScore > baselinePulse.pulseScore
                ? "positive"
                : "negative";
            const message = `🚨 Sentiment ${direction} spike detected! Change: ${delta.toFixed(2)} (${this.SPIKE_MIN_SIGNALS}+ articles in last 24h)`;
            await this.createAlert(userId, candidateId, client_1.AlertType.SENTIMENT_SPIKE, message);
            this.logger.log(`Spike alert created for candidate #${candidateId}`);
        }
    }
    async checkNegativeSurge(candidateId, userId) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const recentSignals = await this.prisma.sentimentSignal.findMany({
            where: {
                createdAt: { gte: yesterday },
                sentiment: client_1.SentimentLabel.NEGATIVE,
                confidence: { gte: this.SURGE_MIN_CONFIDENCE },
                newsArticle: {
                    entityMentions: {
                        some: {
                            entityType: "CANDIDATE",
                            entityId: candidateId,
                        },
                    },
                },
            },
        });
        if (recentSignals.length >= this.SURGE_MIN_COUNT) {
            const message = `⚠️ Negative coverage surge: ${recentSignals.length} high-confidence negative articles detected in last 24 hours`;
            await this.createAlert(userId, candidateId, client_1.AlertType.CONTROVERSY, message);
            this.logger.log(`Surge alert created for candidate #${candidateId}`);
        }
    }
    async checkHighConfidenceHits(candidateId, userId) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const criticalSignals = await this.prisma.sentimentSignal.findMany({
            where: {
                createdAt: { gte: yesterday },
                sentimentScore: { lte: this.HIT_SCORE_THRESHOLD },
                confidence: { gte: this.HIT_CONFIDENCE_THRESHOLD },
                newsArticle: {
                    entityMentions: {
                        some: {
                            entityType: "CANDIDATE",
                            entityId: candidateId,
                        },
                    },
                },
            },
            include: {
                newsArticle: true,
            },
        });
        for (const signal of criticalSignals) {
            const existing = await this.prisma.alert.findFirst({
                where: {
                    userId,
                    message: { contains: signal.newsArticle.title },
                },
            });
            if (!existing) {
                const message = `🔴 High-impact negative coverage: "${signal.newsArticle.title}" (Confidence: ${(signal.confidence * 100).toFixed(0)}%)`;
                const geoUnitId = signal.geoUnitId;
                await this.createAlert(userId, candidateId, client_1.AlertType.NEWS_MENTION, message, geoUnitId);
                this.logger.log(`High-impact alert created for candidate #${candidateId}`);
            }
        }
    }
    async createAlert(userId, candidateId, type, message, geoUnitId) {
        if (!geoUnitId) {
            const profile = await this.prisma.candidateProfile.findUnique({
                where: { candidateId },
            });
            geoUnitId = (profile === null || profile === void 0 ? void 0 : profile.primaryGeoUnitId) || 1;
        }
        await this.prisma.alert.create({
            data: {
                userId,
                geoUnitId,
                type,
                message,
                isRead: false,
            },
        });
    }
    async triggerAlertDetection() {
        this.logger.log("Manual alert detection triggered");
        await this.detectAlerts();
    }
};
exports.AlertService = AlertService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AlertService.prototype, "detectAlerts", null);
exports.AlertService = AlertService = AlertService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        candidate_pulse_service_1.CandidatePulseService])
], AlertService);
//# sourceMappingURL=alert.service.js.map
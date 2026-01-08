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
var CandidatePulseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandidatePulseService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const relevance_calculator_service_1 = require("./relevance-calculator.service");
let CandidatePulseService = CandidatePulseService_1 = class CandidatePulseService {
    constructor(prisma, relevanceCalculator) {
        this.prisma = prisma;
        this.relevanceCalculator = relevanceCalculator;
        this.logger = new common_1.Logger(CandidatePulseService_1.name);
    }
    async calculatePulse(candidateId, days = 7) {
        this.logger.debug(`Calculating pulse for candidate #${candidateId}, window: ${days} days`);
        const candidate = await this.prisma.candidate.findUnique({
            where: { id: candidateId },
            include: {
                party: true,
            },
        });
        if (!candidate) {
            throw new common_1.NotFoundException(`Candidate #${candidateId} not found`);
        }
        const profile = await this.prisma.candidateProfile.findUnique({
            where: { candidateId },
            include: {
                geoUnit: true,
            },
        });
        const targetPartyId = candidate.partyId;
        const targetGeoUnitId = profile.primaryGeoUnitId;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const signals = await this.prisma.sentimentSignal.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
                OR: [
                    {
                        sourceEntityType: "CANDIDATE",
                        sourceEntityId: candidateId,
                    },
                    {
                        sourceEntityType: "PARTY",
                        sourceEntityId: targetPartyId,
                    },
                    {
                        sourceEntityType: "GEO_UNIT",
                        sourceEntityId: targetGeoUnitId,
                    },
                    {
                        relevanceWeight: null,
                        newsArticle: {
                            entityMentions: {
                                some: {
                                    OR: [
                                        { entityType: "CANDIDATE", entityId: candidateId },
                                        { entityType: "PARTY", entityId: targetPartyId },
                                        { entityType: "GEO_UNIT", entityId: targetGeoUnitId },
                                    ],
                                },
                            },
                        },
                    },
                ],
            },
            include: {
                newsArticle: {
                    include: {
                        entityMentions: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        this.logger.debug(`Found ${signals.length} signals for candidate #${candidateId}`);
        if (signals.length === 0) {
            return {
                candidateId,
                candidateName: candidate.fullName,
                partyName: candidate.party.name,
                pulseScore: 0,
                trend: "STABLE",
                articlesAnalyzed: 0,
                timeWindow: `${days} days`,
                lastUpdated: new Date(),
                topDrivers: [],
            };
        }
        const scoredSignals = signals.map((signal) => {
            var _a;
            let relevanceWeight = signal.relevanceWeight;
            if (!relevanceWeight) {
                relevanceWeight = this.relevanceCalculator.calculateRelevanceWeight(((_a = signal.newsArticle) === null || _a === void 0 ? void 0 : _a.entityMentions) || [], candidateId, targetPartyId, targetGeoUnitId);
            }
            const effectiveScore = signal.sentimentScore * signal.confidence * relevanceWeight;
            return Object.assign(Object.assign({}, signal), { relevanceWeight,
                effectiveScore });
        });
        const totalEffectiveScore = scoredSignals.reduce((sum, s) => sum + s.effectiveScore, 0);
        const pulseScore = totalEffectiveScore / scoredSignals.length;
        const trend = await this.calculateTrend(candidateId, days);
        const topDrivers = scoredSignals
            .sort((a, b) => Math.abs(b.effectiveScore) - Math.abs(a.effectiveScore))
            .slice(0, 5)
            .map((signal) => ({
            articleId: signal.newsArticle.id,
            headline: signal.newsArticle.title,
            sentiment: signal.sentiment,
            sentimentScore: signal.sentimentScore,
            confidence: signal.confidence,
            relevanceWeight: signal.relevanceWeight,
            effectiveScore: signal.effectiveScore,
            publishedAt: signal.newsArticle.publishedAt,
        }));
        return {
            candidateId,
            candidateName: candidate.fullName,
            partyName: candidate.party.name,
            pulseScore: Math.round(pulseScore * 10000) / 10000,
            trend,
            articlesAnalyzed: signals.length,
            timeWindow: `${days} days`,
            lastUpdated: new Date(),
            topDrivers,
        };
    }
    async calculateTrend(candidateId, days) {
        const THRESHOLD = 0.15;
        try {
            const recentPulse = await this.calculatePulse(candidateId, 2);
            const baselinePulse = await this.calculatePulse(candidateId, days);
            const delta = recentPulse.pulseScore - baselinePulse.pulseScore;
            if (delta > THRESHOLD)
                return "RISING";
            if (delta < -THRESHOLD)
                return "DECLINING";
            return "STABLE";
        }
        catch (error) {
            return "STABLE";
        }
    }
    async getPulseTrend(candidateId, days = 30) {
        const trend = [];
        for (let i = days; i >= 0; i--) {
            const pulse = await this.calculatePulse(candidateId, i);
            const date = new Date();
            date.setDate(date.getDate() - i);
            trend.push({
                date: date.toISOString().split("T")[0],
                pulseScore: pulse.pulseScore,
            });
        }
        return trend;
    }
};
exports.CandidatePulseService = CandidatePulseService;
exports.CandidatePulseService = CandidatePulseService = CandidatePulseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        relevance_calculator_service_1.RelevanceCalculatorService])
], CandidatePulseService);
//# sourceMappingURL=candidate-pulse.service.js.map
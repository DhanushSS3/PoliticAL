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
var NewsIntelligenceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsIntelligenceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const cache_service_1 = require("../../common/services/cache.service");
const client_1 = require("@prisma/client");
let NewsIntelligenceService = NewsIntelligenceService_1 = class NewsIntelligenceService {
    constructor(prisma, cacheService) {
        this.prisma = prisma;
        this.cacheService = cacheService;
        this.logger = new common_1.Logger(NewsIntelligenceService_1.name);
    }
    async validateGeoAccess(geoUnitId, userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });
        if ((user === null || user === void 0 ? void 0 : user.role) === 'ADMIN') {
            return true;
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
            include: {
                access: {
                    where: { geoUnitId }
                }
            }
        });
        return subscription !== null && subscription.access.length > 0;
    }
    async getUserAccessibleGeoUnits(userId) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
            include: {
                access: {
                    select: { geoUnitId: true }
                }
            }
        });
        return (subscription === null || subscription === void 0 ? void 0 : subscription.access.map(a => a.geoUnitId)) || [];
    }
    async resolveGeoUnitId(identifier, userId) {
        if (!identifier && userId) {
            const accessibleGeoUnits = await this.getUserAccessibleGeoUnits(userId);
            return accessibleGeoUnits[0] || null;
        }
        if (!identifier || identifier === 'all')
            return null;
        const numericId = typeof identifier === 'number' ? identifier : parseInt(identifier);
        if (!isNaN(numericId)) {
            if (userId) {
                const hasAccess = await this.validateGeoAccess(numericId, userId);
                if (!hasAccess) {
                    this.logger.warn(`User #${userId} does not have access to geoUnit #${numericId}`);
                    return null;
                }
            }
            return numericId;
        }
        const name = identifier.toString();
        const cacheKey = `geo-resolve:${name.toLowerCase()}`;
        const cachedId = await this.cacheService.get(cacheKey);
        if (cachedId) {
            if (userId) {
                const hasAccess = await this.validateGeoAccess(cachedId, userId);
                if (!hasAccess) {
                    this.logger.warn(`User #${userId} does not have access to geoUnit #${cachedId}`);
                    return null;
                }
            }
            return cachedId;
        }
        const unit = await this.prisma.geoUnit.findFirst({
            where: {
                OR: [
                    { name: { contains: name, mode: 'insensitive' } },
                    { code: { contains: name, mode: 'insensitive' } }
                ]
            },
            select: { id: true }
        });
        if (unit) {
            await this.cacheService.set(cacheKey, unit.id, 86400);
            if (userId) {
                const hasAccess = await this.validateGeoAccess(unit.id, userId);
                if (!hasAccess) {
                    this.logger.warn(`User #${userId} does not have access to geoUnit #${unit.id}`);
                    return null;
                }
            }
            return unit.id;
        }
        return null;
    }
    async getProjectedWinner(geoUnitId, userId) {
        var _a, _b, _c, _d;
        const resolvedId = await this.resolveGeoUnitId(geoUnitId, userId);
        if (!resolvedId)
            return null;
        const cacheKey = `news-intel:winner:${resolvedId}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached)
            return cached;
        const candidates = await this.prisma.candidateProfile.findMany({
            where: { primaryGeoUnitId: resolvedId },
            include: {
                candidate: { include: { party: true } },
                geoUnit: true,
            },
        });
        if (candidates.length === 0) {
            return {
                projectedWinner: null,
                allCandidates: [],
                lastUpdated: new Date().toISOString(),
            };
        }
        const lastElection = await this.prisma.geoElectionSummary.findFirst({
            where: { geoUnitId: resolvedId },
            orderBy: { election: { year: 'desc' } },
            include: { election: true, partyResults: true },
        });
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const predictions = await Promise.all(candidates.map(async (profile) => {
            const sentiments = await this.prisma.sentimentSignal.findMany({
                where: {
                    sourceEntityType: client_1.EntityType.CANDIDATE,
                    sourceEntityId: profile.candidateId,
                    createdAt: { gte: thirtyDaysAgo },
                },
            });
            let score = 0;
            if ((lastElection === null || lastElection === void 0 ? void 0 : lastElection.winningParty) === profile.candidate.party.name) {
                score += 40;
            }
            const avgSentiment = sentiments.length > 0
                ? sentiments.reduce((sum, s) => sum + s.sentimentScore, 0) /
                    sentiments.length
                : 0;
            score += ((avgSentiment + 1) / 2) * 30;
            const partyWave = await this.getPartyWave(profile.partyId);
            score += partyWave * 20;
            const isIncumbent = (lastElection === null || lastElection === void 0 ? void 0 : lastElection.winningParty) === profile.candidate.party.name;
            const negativeRatio = sentiments.filter((s) => s.sentiment === client_1.SentimentLabel.NEGATIVE)
                .length / (sentiments.length || 1);
            if (isIncumbent && negativeRatio > 0.5) {
                score -= 10;
            }
            return {
                candidateId: profile.candidateId,
                name: profile.candidate.fullName,
                party: profile.candidate.party.name,
                winProbability: Math.min(Math.max(score, 0), 100),
                sentimentScore: `${avgSentiment > 0 ? '+' : ''}${(avgSentiment * 100).toFixed(0)}%`,
                sentimentTrend: this.calculateTrend(sentiments),
            };
        }));
        predictions.sort((a, b) => b.winProbability - a.winProbability);
        const result = {
            candidateName: ((_a = predictions[0]) === null || _a === void 0 ? void 0 : _a.name) || 'N/A',
            partyName: ((_b = predictions[0]) === null || _b === void 0 ? void 0 : _b.party) || 'N/A',
            probability: (((_c = predictions[0]) === null || _c === void 0 ? void 0 : _c.winProbability) || 0) / 100,
            reasoning: ((_d = predictions[0]) === null || _d === void 0 ? void 0 : _d.sentimentTrend) === 'up' ? 'Rising positive sentiment' : 'Stable support base',
            allCandidates: predictions,
            lastUpdated: new Date().toISOString(),
        };
        await this.cacheService.set(cacheKey, result, 3600);
        return result;
    }
    async getControversies(geoUnitId, days = 7, limit = 5, userId) {
        const resolvedId = await this.resolveGeoUnitId(geoUnitId, userId);
        if (!resolvedId)
            return [];
        const cacheKey = `news-intel:controversies:${resolvedId}:${days}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached)
            return cached;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const sentimentSignals = await this.prisma.sentimentSignal.findMany({
            where: {
                geoUnitId: resolvedId,
                sentiment: client_1.SentimentLabel.NEGATIVE,
                createdAt: { gte: cutoff },
            },
            include: {
                newsArticle: {
                    where: {
                        status: 'APPROVED'
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit * 3,
        });
        const controversies = sentimentSignals
            .filter((s) => s.newsArticle !== null)
            .map((s) => ({
            id: s.newsArticle.id,
            description: s.newsArticle.title,
            summary: s.newsArticle.summary,
            type: 'Negative Coverage',
            sentiment: 'negative',
            impactScore: Math.round(Math.abs(s.sentimentScore) * 100),
            timestamp: this.formatRelativeTime(s.newsArticle.publishedAt),
            date: s.newsArticle.publishedAt.toISOString(),
            sourceUrl: s.newsArticle.sourceUrl,
        }))
            .sort((a, b) => b.impactScore - a.impactScore)
            .slice(0, limit);
        this.logger.debug(`Found ${controversies.length} controversies for geoUnit #${resolvedId} in last ${days} days`);
        await this.cacheService.set(cacheKey, controversies, 900);
        return controversies;
    }
    async getHeadToHead(candidate1Id, candidate2Id, days = 30, userId) {
        const cacheKey = `news-intel:h2h:${candidate1Id}:${candidate2Id}:${days}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached)
            return cached;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const [c1, c2] = await Promise.all([
            this.getCandidateSentiment(candidate1Id, cutoff),
            this.getCandidateSentiment(candidate2Id, cutoff),
        ]);
        const sentimentTrend = [];
        const result = {
            candidate1: c1,
            candidate2: c2,
            sentimentTrend,
        };
        await this.cacheService.set(cacheKey, result, 1800);
        return result;
    }
    async getNewsImpact(geoUnitId, days = 7, userId) {
        const resolvedId = await this.resolveGeoUnitId(geoUnitId, userId);
        if (!resolvedId)
            return null;
        const cacheKey = `news-intel:impact:${resolvedId}:${days}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached)
            return cached;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const articles = await this.prisma.newsArticle.findMany({
            where: {
                publishedAt: { gte: cutoff },
                status: 'APPROVED',
                entityMentions: {
                    some: {
                        entityType: client_1.EntityType.GEO_UNIT,
                        entityId: resolvedId,
                    },
                },
            },
            include: {
                sentimentSignals: true,
                entityMentions: true,
            },
            orderBy: { publishedAt: 'desc' },
            take: 50,
        });
        const headlines = articles.slice(0, 20).map((a) => {
            var _a;
            return ({
                id: a.id,
                headline: a.title,
                summary: a.summary,
                sentiment: ((_a = a.sentimentSignals[0]) === null || _a === void 0 ? void 0 : _a.sentiment.toLowerCase()) || 'neutral',
                party: 'N/A',
                timestamp: this.formatRelativeTime(a.publishedAt),
                url: a.sourceUrl,
                virality: this.calculateVirality(a),
            });
        });
        const result = {
            impactTopics: [],
            headlines,
            sentimentDistribution: {
                positive: articles.filter((a) => a.sentimentSignals.some((s) => s.sentiment === client_1.SentimentLabel.POSITIVE)).length,
                negative: articles.filter((a) => a.sentimentSignals.some((s) => s.sentiment === client_1.SentimentLabel.NEGATIVE)).length,
                neutral: articles.filter((a) => a.sentimentSignals.some((s) => s.sentiment === client_1.SentimentLabel.NEUTRAL)).length,
            },
        };
        await this.cacheService.set(cacheKey, result, 600);
        return result;
    }
    async getLiveFeed(geoUnitId, partyId, limit = 20, userId) {
        const accessibleGeoUnits = userId ? await this.getUserAccessibleGeoUnits(userId) : [];
        const resolvedId = geoUnitId ? await this.resolveGeoUnitId(geoUnitId, userId) : null;
        const cacheKey = `news-intel:feed:${resolvedId || 'user-' + userId}:${partyId || 'all'}:${limit}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached)
            return cached;
        const where = {
            status: 'APPROVED',
            publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        };
        if (resolvedId || partyId || accessibleGeoUnits.length > 0) {
            where.entityMentions = { some: { OR: [] } };
            if (resolvedId) {
                where.entityMentions.some.OR.push({
                    entityType: client_1.EntityType.GEO_UNIT,
                    entityId: resolvedId,
                });
            }
            else if (accessibleGeoUnits.length > 0) {
                where.entityMentions.some.OR.push({
                    entityType: client_1.EntityType.GEO_UNIT,
                    entityId: { in: accessibleGeoUnits },
                });
            }
            if (partyId) {
                where.entityMentions.some.OR.push({
                    entityType: client_1.EntityType.PARTY,
                    entityId: partyId,
                });
            }
        }
        const articles = await this.prisma.newsArticle.findMany({
            where,
            include: {
                sentimentSignals: true,
                entityMentions: true,
            },
            orderBy: { publishedAt: 'desc' },
            take: limit,
        });
        const result = articles.map((a) => {
            var _a, _b;
            return ({
                id: a.id,
                headline: a.title,
                summary: a.summary,
                party: 'N/A',
                sentiment: ((_a = a.sentimentSignals[0]) === null || _a === void 0 ? void 0 : _a.sentiment.toLowerCase()) || 'neutral',
                virality: this.calculateVirality(a),
                timestamp: this.formatRelativeTime(a.publishedAt),
                url: a.sourceUrl,
                impactScore: Math.round(Math.abs(((_b = a.sentimentSignals[0]) === null || _b === void 0 ? void 0 : _b.sentimentScore) || 0) * 100),
                relatedEntities: {
                    candidates: [],
                    parties: [],
                },
            });
        });
        await this.cacheService.set(cacheKey, result, 300);
        return result;
    }
    async getDashboardSentiment(days = 7, partyLimit = 3) {
        const cacheKey = `dashboard:sentiment:top:${partyLimit}:${days}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached)
            return cached;
        const latestElection = await this.prisma.election.findFirst({
            orderBy: { year: 'desc' },
        });
        const emptyResult = {
            overall: { positive: 0, neutral: 0, negative: 0 },
            byParty: {},
        };
        if (!latestElection) {
            await this.cacheService.set(cacheKey, emptyResult, 300);
            return emptyResult;
        }
        const topParties = await this.prisma.partySeatSummary.findMany({
            where: { electionId: latestElection.id },
            include: { party: true },
            orderBy: { seatsWon: 'desc' },
            take: partyLimit,
        });
        if (topParties.length === 0) {
            await this.cacheService.set(cacheKey, emptyResult, 300);
            return emptyResult;
        }
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const byParty = {};
        let totalPositive = 0;
        let totalNeutral = 0;
        let totalNegative = 0;
        for (const stat of topParties) {
            const code = stat.party.symbol || stat.party.name.substring(0, 3).toUpperCase();
            const signals = await this.prisma.sentimentSignal.findMany({
                where: {
                    sourceEntityType: client_1.EntityType.PARTY,
                    sourceEntityId: stat.partyId,
                    createdAt: { gte: cutoff },
                },
            });
            const positiveCount = signals.filter((s) => s.sentiment === client_1.SentimentLabel.POSITIVE).length;
            const negativeCount = signals.filter((s) => s.sentiment === client_1.SentimentLabel.NEGATIVE).length;
            const neutralCount = signals.filter((s) => s.sentiment === client_1.SentimentLabel.NEUTRAL).length;
            const total = positiveCount + negativeCount + neutralCount || 1;
            const partyStats = {
                positive: Math.round((positiveCount / total) * 100),
                neutral: Math.round((neutralCount / total) * 100),
                negative: Math.round((negativeCount / total) * 100),
            };
            byParty[code] = partyStats;
            totalPositive += positiveCount;
            totalNeutral += neutralCount;
            totalNegative += negativeCount;
        }
        const overallTotal = totalPositive + totalNeutral + totalNegative || 1;
        const overall = {
            positive: Math.round((totalPositive / overallTotal) * 100),
            neutral: Math.round((totalNeutral / overallTotal) * 100),
            negative: Math.round((totalNegative / overallTotal) * 100),
        };
        const result = { overall, byParty };
        await this.cacheService.set(cacheKey, result, 300);
        return result;
    }
    async getDashboardNewsImpact(days = 7, partyLimit = 3) {
        const cacheKey = `dashboard:news-impact:top:${partyLimit}:${days}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached)
            return cached;
        const latestElection = await this.prisma.election.findFirst({
            orderBy: { year: 'desc' },
        });
        const baseResult = {
            impactTopics: [],
            headlines: [],
        };
        if (!latestElection) {
            await this.cacheService.set(cacheKey, baseResult, 300);
            return baseResult;
        }
        const topParties = await this.prisma.partySeatSummary.findMany({
            where: { electionId: latestElection.id },
            include: { party: true },
            orderBy: { seatsWon: 'desc' },
            take: partyLimit,
        });
        if (topParties.length === 0) {
            await this.cacheService.set(cacheKey, baseResult, 300);
            return baseResult;
        }
        const partyIds = topParties.map((p) => p.partyId);
        const partyCodeMap = new Map();
        for (const stat of topParties) {
            const code = stat.party.symbol || stat.party.name.substring(0, 3).toUpperCase();
            partyCodeMap.set(stat.partyId, code);
        }
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const articles = await this.prisma.newsArticle.findMany({
            where: {
                status: 'APPROVED',
                publishedAt: { gte: cutoff },
                entityMentions: {
                    some: {
                        entityType: client_1.EntityType.PARTY,
                        entityId: { in: partyIds },
                    },
                },
            },
            include: {
                sentimentSignals: true,
                entityMentions: true,
            },
            orderBy: { publishedAt: 'desc' },
            take: 50,
        });
        if (articles.length === 0) {
            await this.cacheService.set(cacheKey, baseResult, 300);
            return baseResult;
        }
        const items = articles.map((a) => {
            const partyMention = a.entityMentions.find((m) => m.entityType === client_1.EntityType.PARTY &&
                partyIds.includes(m.entityId));
            const partyId = partyMention === null || partyMention === void 0 ? void 0 : partyMention.entityId;
            const partyCode = partyId ? partyCodeMap.get(partyId) || 'OTHER' : 'OTHER';
            const sentimentSignal = a.sentimentSignals[0];
            let sentiment = 'neutral';
            if ((sentimentSignal === null || sentimentSignal === void 0 ? void 0 : sentimentSignal.sentiment) === client_1.SentimentLabel.POSITIVE) {
                sentiment = 'positive';
            }
            else if ((sentimentSignal === null || sentimentSignal === void 0 ? void 0 : sentimentSignal.sentiment) === client_1.SentimentLabel.NEGATIVE) {
                sentiment = 'negative';
            }
            const baseScore = Math.abs((sentimentSignal === null || sentimentSignal === void 0 ? void 0 : sentimentSignal.sentimentScore) || 0);
            const virality = this.calculateVirality(a);
            const viralityBoost = virality === 'VIRAL' ? 1.5 : virality === 'TRENDING' ? 1.2 : 1;
            const impactScore = baseScore * viralityBoost || 0.1;
            return {
                id: a.id,
                title: a.title,
                sentiment,
                partyCode,
                impactScore,
                publishedAt: a.publishedAt,
            };
        });
        const totalImpact = items.reduce((sum, item) => sum + item.impactScore, 0) || 1;
        const impactTopics = items.slice(0, 5).map((item) => ({
            topic: item.title,
            impact: Math.round((item.impactScore / totalImpact) * 100),
            sentiment: item.sentiment,
            party: item.partyCode,
        }));
        const headlines = items.slice(0, 10).map((item) => ({
            id: item.id,
            headline: item.title,
            sentiment: item.sentiment,
            party: item.partyCode,
            time: this.formatRelativeTime(item.publishedAt),
        }));
        const result = Object.assign(Object.assign({}, baseResult), { impactTopics, headlines });
        await this.cacheService.set(cacheKey, result, 300);
        return result;
    }
    async getPartyWave(partyId) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const stateSentiments = await this.prisma.sentimentSignal.findMany({
            where: {
                sourceEntityType: client_1.EntityType.PARTY,
                sourceEntityId: partyId,
                createdAt: { gte: thirtyDaysAgo },
            },
        });
        const avgScore = stateSentiments.length > 0
            ? stateSentiments.reduce((sum, s) => sum + s.sentimentScore, 0) /
                stateSentiments.length
            : 0;
        return (avgScore + 1) / 2;
    }
    calculateTrend(sentiments) {
        if (sentiments.length < 2)
            return 'stable';
        const sorted = sentiments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
        const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
        const avgFirst = firstHalf.reduce((sum, s) => sum + s.sentimentScore, 0) /
            firstHalf.length;
        const avgSecond = secondHalf.reduce((sum, s) => sum + s.sentimentScore, 0) /
            secondHalf.length;
        if (avgSecond > avgFirst + 0.1)
            return 'up';
        if (avgSecond < avgFirst - 0.1)
            return 'down';
        return 'stable';
    }
    async getCandidateSentiment(candidateId, since) {
        const candidate = await this.prisma.candidate.findUnique({
            where: { id: candidateId },
            include: { party: true },
        });
        const sentiments = await this.prisma.sentimentSignal.findMany({
            where: {
                sourceEntityType: client_1.EntityType.CANDIDATE,
                sourceEntityId: candidateId,
                createdAt: { gte: since },
            },
        });
        const positive = sentiments.filter((s) => s.sentiment === client_1.SentimentLabel.POSITIVE).length;
        const negative = sentiments.filter((s) => s.sentiment === client_1.SentimentLabel.NEGATIVE).length;
        const neutral = sentiments.filter((s) => s.sentiment === client_1.SentimentLabel.NEUTRAL).length;
        const total = sentiments.length || 1;
        return {
            candidateId,
            name: candidate.fullName,
            party: candidate.party.name,
            positive: Math.round((positive / total) * 100),
            negative: Math.round((negative / total) * 100),
            neutral: Math.round((neutral / total) * 100),
            netSentiment: Math.round(((positive - negative) / total) * 100),
            articleCount: total,
        };
    }
    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 60)
            return `${diffMins}m ago`;
        if (diffHours < 24)
            return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    }
    calculateVirality(article) {
        var _a;
        const mentionCount = ((_a = article.entityMentions) === null || _a === void 0 ? void 0 : _a.length) || 0;
        const hoursSincePublished = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSincePublished <= 24) {
            if (mentionCount >= 10)
                return 'VIRAL';
            if (mentionCount >= 5)
                return 'TRENDING';
        }
        return null;
    }
};
exports.NewsIntelligenceService = NewsIntelligenceService;
exports.NewsIntelligenceService = NewsIntelligenceService = NewsIntelligenceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService])
], NewsIntelligenceService);
//# sourceMappingURL=news-intelligence.service.js.map
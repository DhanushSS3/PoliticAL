import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { EntityType, SentimentLabel } from '@prisma/client';

@Injectable()
export class NewsIntelligenceService {
    private readonly logger = new Logger(NewsIntelligenceService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) { }

    /**
     * Get user's accessible geoUnits based on subscription
     */
    private async getUserAccessibleGeoUnits(userId: number): Promise<number[]> {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
            include: {
                access: {
                    select: { geoUnitId: true }
                }
            }
        });

        return subscription?.access.map(a => a.geoUnitId) || [];
    }

    /**
     * Resolve a geo unit identifier (ID or Name) to a numeric ID
     * If no identifier provided, returns user's first accessible geoUnit
     */
    private async resolveGeoUnitId(identifier?: string | number, userId?: number): Promise<number | null> {
        // If no identifier and userId provided, use user's first accessible geoUnit
        if (!identifier && userId) {
            const accessibleGeoUnits = await this.getUserAccessibleGeoUnits(userId);
            return accessibleGeoUnits[0] || null;
        }

        if (!identifier || identifier === 'all') return null;

        // 1. If it's already a number or numeric string
        const numericId = typeof identifier === 'number' ? identifier : parseInt(identifier);
        if (!isNaN(numericId)) return numericId;

        // 2. Resolve by name
        const name = identifier.toString();

        // Check cache first for name resolution
        const cacheKey = `geo-resolve:${name.toLowerCase()}`;
        const cachedId = await this.cacheService.get<number>(cacheKey);
        if (cachedId) return cachedId;

        // Try exact match or partial match
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
            await this.cacheService.set(cacheKey, unit.id, 86400); // Cache resolution for 24h
            return unit.id;
        }

        return null;
    }

    /**
     * Get projected winner for a constituency using rule-based prediction
     */
    async getProjectedWinner(geoUnitId?: string | number, userId?: number) {
        const resolvedId = await this.resolveGeoUnitId(geoUnitId, userId);
        if (!resolvedId) return null;

        const cacheKey = `news-intel:winner:${resolvedId}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached) return cached;

        // 1. Get candidates in constituency
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

        // 2. Get last election result
        const lastElection = await this.prisma.geoElectionSummary.findFirst({
            where: { geoUnitId: resolvedId },
            orderBy: { election: { year: 'desc' } },
            include: { election: true, partyResults: true },
        });

        // 3. Calculate predictions for each candidate
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const predictions = await Promise.all(
            candidates.map(async (profile) => {
                const sentiments = await this.prisma.sentimentSignal.findMany({
                    where: {
                        sourceEntityType: EntityType.CANDIDATE,
                        sourceEntityId: profile.candidateId,
                        createdAt: { gte: thirtyDaysAgo },
                    },
                });

                // Calculate scores using rule-based formula
                let score = 0;

                // Historical advantage (40%)
                if (lastElection?.winningParty === profile.candidate.party.name) {
                    score += 40;
                }

                // Sentiment score (30%)
                const avgSentiment =
                    sentiments.length > 0
                        ? sentiments.reduce((sum, s) => sum + s.sentimentScore, 0) /
                        sentiments.length
                        : 0;
                score += ((avgSentiment + 1) / 2) * 30; // Normalize -1..1 to 0..30

                // Party wave (20%) - State-level sentiment
                const partyWave = await this.getPartyWave(profile.partyId);
                score += partyWave * 20;

                // Incumbency penalty (10%)
                const isIncumbent = lastElection?.winningParty === profile.candidate.party.name;
                const negativeRatio =
                    sentiments.filter((s) => s.sentiment === SentimentLabel.NEGATIVE)
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
            }),
        );

        // Sort by win probability
        predictions.sort((a, b) => b.winProbability - a.winProbability);

        const result = {
            candidateName: predictions[0]?.name || 'N/A',
            partyName: predictions[0]?.party || 'N/A',
            probability: (predictions[0]?.winProbability || 0) / 100,
            reasoning: predictions[0]?.sentimentTrend === 'up' ? 'Rising positive sentiment' : 'Stable support base',
            allCandidates: predictions,
            lastUpdated: new Date().toISOString(),
        };

        // Cache for 1 hour
        await this.cacheService.set(cacheKey, result, 3600);

        return result;
    }

    /**
     * Get recent controversies for a constituency
     */
    async getControversies(
        geoUnitId?: string | number,
        days: number = 7,
        limit: number = 5,
        userId?: number,
    ) {
        const resolvedId = await this.resolveGeoUnitId(geoUnitId, userId);
        if (!resolvedId) return [];

        const cacheKey = `news-intel:controversies:${resolvedId}:${days}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached) return cached;

        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Get news articles mentioning this constituency with negative sentiment
        const articles = await this.prisma.newsArticle.findMany({
            where: {
                publishedAt: { gte: cutoff },
                status: 'APPROVED',
                entityMentions: {
                    some: {
                        entityType: EntityType.GEO_UNIT,
                        entityId: resolvedId,
                    },
                },
            },
            include: {
                sentimentSignals: {
                    where: { sentiment: SentimentLabel.NEGATIVE },
                },
                entityMentions: true,
            },
            orderBy: { publishedAt: 'desc' },
            take: limit * 3, // Fetch more, filter later
        });

        // Calculate impact scores and filter
        const controversies = articles
            .filter((a) => a.sentimentSignals.length > 0)
            .map((a) => ({
                id: a.id,
                description: a.title,
                summary: a.summary,
                type: 'Negative Coverage',
                sentiment: 'negative' as const,
                impactScore: Math.round(
                    Math.abs(a.sentimentSignals[0].sentimentScore) * 100,
                ),
                timestamp: this.formatRelativeTime(a.publishedAt),
                date: a.publishedAt.toISOString(),
                sourceUrl: a.sourceUrl,
            }))
            .sort((a, b) => b.impactScore - a.impactScore)
            .slice(0, limit);

        // Cache for 15 minutes
        await this.cacheService.set(cacheKey, controversies, 900);

        return controversies;
    }

    /**
     * Get head-to-head sentiment comparison between two candidates
     */
    async getHeadToHead(
        candidate1Id: number,
        candidate2Id: number,
        days: number = 30,
        userId?: number,
    ) {
        const cacheKey = `news-intel:h2h:${candidate1Id}:${candidate2Id}:${days}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached) return cached;

        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const [c1, c2] = await Promise.all([
            this.getCandidateSentiment(candidate1Id, cutoff),
            this.getCandidateSentiment(candidate2Id, cutoff),
        ]);

        // Get daily trend (simplified - just return empty for now)
        const sentimentTrend = [];

        const result = {
            candidate1: c1,
            candidate2: c2,
            sentimentTrend,
        };

        // Cache for 30 minutes
        await this.cacheService.set(cacheKey, result, 1800);

        return result;
    }

    /**
     * Get news impact analysis for a geo unit
     */
    async getNewsImpact(geoUnitId?: string | number, days: number = 7, userId?: number) {
        const resolvedId = await this.resolveGeoUnitId(geoUnitId, userId);
        if (!resolvedId) return null;

        const cacheKey = `news-intel:impact:${resolvedId}:${days}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached) return cached;

        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Get all news for this geo unit
        const articles = await this.prisma.newsArticle.findMany({
            where: {
                publishedAt: { gte: cutoff },
                status: 'APPROVED',
                entityMentions: {
                    some: {
                        entityType: EntityType.GEO_UNIT,
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

        // Format headlines
        const headlines = articles.slice(0, 20).map((a) => ({
            id: a.id,
            headline: a.title,
            summary: a.summary,
            sentiment: a.sentimentSignals[0]?.sentiment.toLowerCase() || 'neutral',
            party: 'N/A', // TODO: Extract from entityMentions
            timestamp: this.formatRelativeTime(a.publishedAt),
            url: a.sourceUrl,
            virality: this.calculateVirality(a),
        }));

        const result = {
            impactTopics: [], // TODO: Aggregate by party
            headlines,
            sentimentDistribution: {
                positive: articles.filter((a) =>
                    a.sentimentSignals.some((s) => s.sentiment === SentimentLabel.POSITIVE),
                ).length,
                negative: articles.filter((a) =>
                    a.sentimentSignals.some((s) => s.sentiment === SentimentLabel.NEGATIVE),
                ).length,
                neutral: articles.filter((a) =>
                    a.sentimentSignals.some((s) => s.sentiment === SentimentLabel.NEUTRAL),
                ).length,
            },
        };

        // Cache for 10 minutes
        await this.cacheService.set(cacheKey, result, 600);

        return result;
    }

    /**
     * Get live news feed
     * If no geoUnitId provided, shows news from user's subscribed constituencies
     */
    async getLiveFeed(
        geoUnitId?: string | number,
        partyId?: number,
        limit: number = 20,
        userId?: number,
    ) {
        // Get accessible geoUnits for the user
        const accessibleGeoUnits = userId ? await this.getUserAccessibleGeoUnits(userId) : [];

        const resolvedId = geoUnitId ? await this.resolveGeoUnitId(geoUnitId, userId) : null;

        const cacheKey = `news-intel:feed:${resolvedId || 'user-' + userId}:${partyId || 'all'}:${limit}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached) return cached;

        const where: any = {
            status: 'APPROVED',
            publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        };

        // Filter by resolved geoUnit, or user's accessible geoUnits, or party
        if (resolvedId || partyId || accessibleGeoUnits.length > 0) {
            where.entityMentions = { some: { OR: [] } };

            if (resolvedId) {
                where.entityMentions.some.OR.push({
                    entityType: EntityType.GEO_UNIT,
                    entityId: resolvedId,
                });
            } else if (accessibleGeoUnits.length > 0) {
                // Show news from all accessible geoUnits
                where.entityMentions.some.OR.push({
                    entityType: EntityType.GEO_UNIT,
                    entityId: { in: accessibleGeoUnits },
                });
            }

            if (partyId) {
                where.entityMentions.some.OR.push({
                    entityType: EntityType.PARTY,
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

        const result = articles.map((a) => ({
            id: a.id,
            headline: a.title,
            summary: a.summary,
            party: 'N/A', // TODO: Extract
            sentiment: a.sentimentSignals[0]?.sentiment.toLowerCase() || 'neutral',
            virality: this.calculateVirality(a),
            timestamp: this.formatRelativeTime(a.publishedAt),
            url: a.sourceUrl,
            impactScore: Math.round(
                Math.abs(a.sentimentSignals[0]?.sentimentScore || 0) * 100,
            ),
            relatedEntities: {
                candidates: [],
                parties: [],
            },
        }));

        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, result, 300);

        return result;
    }

    // ========== Private Helper Methods ==========

    private async getPartyWave(partyId: number): Promise<number> {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const stateSentiments = await this.prisma.sentimentSignal.findMany({
            where: {
                sourceEntityType: EntityType.PARTY,
                sourceEntityId: partyId,
                createdAt: { gte: thirtyDaysAgo },
            },
        });

        const avgScore =
            stateSentiments.length > 0
                ? stateSentiments.reduce((sum, s) => sum + s.sentimentScore, 0) /
                stateSentiments.length
                : 0;

        return (avgScore + 1) / 2; // Normalize to 0-1
    }

    private calculateTrend(
        sentiments: Array<{ sentimentScore: number; createdAt: Date }>,
    ): 'up' | 'down' | 'stable' {
        if (sentiments.length < 2) return 'stable';

        const sorted = sentiments.sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        );
        const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
        const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

        const avgFirst =
            firstHalf.reduce((sum, s) => sum + s.sentimentScore, 0) /
            firstHalf.length;
        const avgSecond =
            secondHalf.reduce((sum, s) => sum + s.sentimentScore, 0) /
            secondHalf.length;

        if (avgSecond > avgFirst + 0.1) return 'up';
        if (avgSecond < avgFirst - 0.1) return 'down';
        return 'stable';
    }

    private async getCandidateSentiment(candidateId: number, since: Date) {
        const candidate = await this.prisma.candidate.findUnique({
            where: { id: candidateId },
            include: { party: true },
        });

        const sentiments = await this.prisma.sentimentSignal.findMany({
            where: {
                sourceEntityType: EntityType.CANDIDATE,
                sourceEntityId: candidateId,
                createdAt: { gte: since },
            },
        });

        const positive = sentiments.filter(
            (s) => s.sentiment === SentimentLabel.POSITIVE,
        ).length;
        const negative = sentiments.filter(
            (s) => s.sentiment === SentimentLabel.NEGATIVE,
        ).length;
        const neutral = sentiments.filter(
            (s) => s.sentiment === SentimentLabel.NEUTRAL,
        ).length;
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

    private formatRelativeTime(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    }

    private calculateVirality(article: any): 'VIRAL' | 'TRENDING' | null {
        const mentionCount = article.entityMentions?.length || 0;
        const hoursSincePublished =
            (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60);

        if (hoursSincePublished <= 24) {
            if (mentionCount >= 10) return 'VIRAL';
            if (mentionCount >= 5) return 'TRENDING';
        }
        return null;
    }
}

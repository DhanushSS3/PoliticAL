import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RelevanceCalculatorService } from './relevance-calculator.service';
import { PulseData, TrendData } from '../interfaces/pulse-data.interface';

export { PulseData, TrendData };

/**
 * CandidatePulseService
 * 
 * Calculates weighted average sentiment (pulse score) for candidates
 * based on news articles and their relevance.
 * 
 * Formula:
 * effectiveScore = sentimentScore × confidence × relevanceWeight
 * pulse = AVG(effectiveScores)
 * 
 * SOLID Principles:
 * - Single Responsibility: Only calculates pulse scores
 * - Dependency Inversion: Depends on PrismaService and RelevanceCalculator abstractions
 */
@Injectable()
export class CandidatePulseService {
    private readonly logger = new Logger(CandidatePulseService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly relevanceCalculator: RelevanceCalculatorService,
    ) { }

    /**
     * Calculate pulse score for a candidate
     * 
     * @param candidateId - The candidate ID
     * @param days - Time window in days (default: 7)
     * @returns PulseData with score, trend, and top drivers
     */
    async calculatePulse(candidateId: number, days: number = 7): Promise<PulseData> {
        this.logger.debug(`Calculating pulse for candidate #${candidateId}, window: ${days} days`);

        // 1. Get candidate info with party and profile (using correct Prisma relation)
        const candidate = await this.prisma.candidate.findUnique({
            where: { id: candidateId },
            include: {
                party: true,
            }
        });

        if (!candidate) {
            throw new NotFoundException(`Candidate #${candidateId} not found`);
        }

        // Get profile separately
        const profile = await this.prisma.candidateProfile.findUnique({
            where: { candidateId },
            include: {
                geoUnit: true
            }
        });

        const targetPartyId = candidate.partyId;
        const targetGeoUnitId = candidate.profile.primaryGeoUnitId;

        // 2. Get date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // 3. Get all sentiment signals for this time window
        // We need signals that are:
        // - About the candidate directly, OR
        // - About their constituency, OR
        // - About their party, OR
        // - In their state
        const signals = await this.prisma.sentimentSignal.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate
                },
                // We'll filter by relevance in-memory after fetching
                newsArticle: {
                    entityMentions: {
                        some: {
                            OR: [
                                { entityType: 'CANDIDATE', entityId: candidateId },
                                { entityType: 'PARTY', entityId: targetPartyId },
                                { entityType: 'GEO_UNIT', entityId: targetGeoUnitId },
                            ]
                        }
                    }
                }
            },
            include: {
                newsArticle: {
                    include: {
                        entityMentions: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        this.logger.debug(`Found ${signals.length} signals for candidate #${candidateId}`);

        if (signals.length === 0) {
            return {
                candidateId,
                candidateName: candidate.fullName,
                partyName: candidate.party.name,
                pulseScore: 0,
                trend: 'STABLE',
                articlesAnalyzed: 0,
                timeWindow: `${days} days`,
                lastUpdated: new Date(),
                topDrivers: []
            };
        }

        // 4. Calculate effective scores
        const scoredSignals = signals.map(signal => {
            const relevanceWeight = this.relevanceCalculator.calculateRelevanceWeight(
                signal.newsArticle.entityMentions,
                candidateId,
                targetPartyId,
                targetGeoUnitId
            );

            const effectiveScore = signal.sentimentScore * signal.confidence * relevanceWeight;

            return {
                ...signal,
                relevanceWeight,
                effectiveScore
            };
        });

        // 5. Calculate pulse (weighted average)
        const totalEffectiveScore = scoredSignals.reduce((sum, s) => sum + s.effectiveScore, 0);
        const pulseScore = totalEffectiveScore / scoredSignals.length;

        // 6. Determine trend (compare recent vs older)
        const trend = await this.calculateTrend(candidateId, days);

        // 7. Get top drivers (articles with highest impact)
        const topDrivers = scoredSignals
            .sort((a, b) => Math.abs(b.effectiveScore) - Math.abs(a.effectiveScore))
            .slice(0, 5)
            .map(signal => ({
                articleId: signal.newsArticle.id,
                headline: signal.newsArticle.title,
                sentiment: signal.sentiment,
                sentimentScore: signal.sentimentScore,
                confidence: signal.confidence,
                relevanceWeight: signal.relevanceWeight,
                effectiveScore: signal.effectiveScore,
                publishedAt: signal.newsArticle.publishedAt
            }));

        return {
            candidateId,
            candidateName: candidate.fullName,
            partyName: candidate.party.name,
            pulseScore: Math.round(pulseScore * 10000) / 10000, // Round to 4 decimals
            trend,
            articlesAnalyzed: signals.length,
            timeWindow: `${days} days`,
            lastUpdated: new Date(),
            topDrivers
        };
    }

    /**
     * Calculate trend by comparing recent period to baseline
     * 
     * @param candidateId - Candidate ID
     * @param days - Total window size
     * @returns Trend indicator
     */
    private async calculateTrend(candidateId: number, days: number): Promise<'RISING' | 'STABLE' | 'DECLINING'> {
        const THRESHOLD = 0.15; // Minimum change to be considered a trend

        try {
            // Compare last 2 days vs previous (days-2) days
            const recentPulse = await this.calculatePulse(candidateId, 2);
            const baselinePulse = await this.calculatePulse(candidateId, days);

            const delta = recentPulse.pulseScore - baselinePulse.pulseScore;

            if (delta > THRESHOLD) return 'RISING';
            if (delta < -THRESHOLD) return 'DECLINING';
            return 'STABLE';
        } catch (error) {
            // If we can't calculate trend (not enough data), default to STABLE
            return 'STABLE';
        }
    }

    /**
     * Get pulse time series data for charting
     * 
     * @param candidateId - Candidate ID
     * @param days - Number of days to fetch
     * @returns Array of {date, pulseScore} for each day
     */
    async getPulseTrend(candidateId: number, days: number = 30): Promise<Array<{ date: string; pulseScore: number }>> {
        const trend: Array<{ date: string; pulseScore: number }> = [];

        for (let i = days; i >= 0; i--) {
            const pulse = await this.calculatePulse(candidateId, i);
            const date = new Date();
            date.setDate(date.getDate() - i);

            trend.push({
                date: date.toISOString().split('T')[0], // YYYY-MM-DD
                pulseScore: pulse.pulseScore
            });
        }

        return trend;
    }
}

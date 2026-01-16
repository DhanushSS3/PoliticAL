import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/services/cache.service';

@Injectable()
export class ConstituenciesService {
    private readonly logger = new Logger(ConstituenciesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) { }

    async getMapData(electionId: string, metric: string = 'turnout', level: 'CONSTITUENCY' | 'DISTRICT' = 'CONSTITUENCY') {
        // Resolve election ID
        let eId = electionId ? parseInt(electionId) : undefined;

        if (!eId || isNaN(eId)) {
            const latestElection = await this.prisma.election.findFirst({
                orderBy: { year: 'desc' },
            });
            if (latestElection) eId = latestElection.id;
            else return []; // No elections found
        }

        const cacheKey = `${CacheService.getConstituencyMapKey(eId.toString())}:${level}`;
        const cached = await this.cacheService.get(cacheKey);
        // if (cached) return cached; // caching disabled for dev iteration

        // If Level is DISTRICT, we aggregate from Constituencies to ensure accuracy of "seats won"
        // (unless we trust the district summary table is perfectly maintained)
        if (level === 'DISTRICT') {
            // Fetch all constituencies
            const constituencies = await this.prisma.geoElectionSummary.findMany({
                where: {
                    electionId: eId,
                    geoUnit: { level: 'CONSTITUENCY' }
                },
                select: {
                    geoUnit: {
                        select: { parentId: true, parent: { select: { id: true, name: true, code: true } } }
                    },
                    winningParty: true,
                    partyResults: {
                        orderBy: { voteCount: 'desc' },
                        take: 1,
                        select: { party: { select: { colorHex: true } } }
                    },
                    totalElectors: true,
                    totalVotesCast: true // For turnout calc
                }
            });

            // Aggregate by District
            const districtMap = new Map<number, any>();

            constituencies.forEach(c => {
                const districtId = c.geoUnit.parentId;
                if (!districtId) return;

                if (!districtMap.has(districtId)) {
                    districtMap.set(districtId, {
                        id: districtId,
                        name: c.geoUnit.parent.name,
                        code: c.geoUnit.parent.code,
                        electors: 0,
                        votes: 0,
                        seats: 0,
                        partyCounts: {}
                    });
                }

                const d = districtMap.get(districtId);
                d.electors += c.totalElectors;
                d.votes += c.totalVotesCast;
                d.seats += 1;

                const winner = c.winningParty;
                if (winner) {
                    d.partyCounts[winner] = (d.partyCounts[winner] || 0) + 1;
                    // Store color map?
                    if (c.partyResults[0]?.party?.colorHex) {
                        d.partyColorMap = d.partyColorMap || {};
                        d.partyColorMap[winner] = c.partyResults[0].party.colorHex;
                    }
                }
            });

            return Array.from(districtMap.values()).map(d => {
                // Determine max winner
                let maxSeats = 0;
                let winner = null;
                Object.entries(d.partyCounts).forEach(([party, seats]: [string, any]) => {
                    if (seats > maxSeats) {
                        maxSeats = seats;
                        winner = party;
                    }
                });

                return {
                    constituencyId: d.id, // actually district ID but using interface key
                    name: d.name,
                    code: d.code,
                    turnout: d.electors > 0 ? parseFloat(((d.votes / d.electors) * 100).toFixed(2)) : 0,
                    electors: d.electors,
                    seats: d.seats,
                    winner: winner,
                    margin: 0, // District margin is ambiguous
                    color: winner ? (d.partyColorMap?.[winner] || null) : null
                };
            });

        }

        // Default logic for pure checks (or if we wanted CONSTITUENCY level map)
        const summaries = await this.prisma.geoElectionSummary.findMany({
            where: {
                electionId: eId,
                geoUnit: { level: level }
            },
            select: {
                geoUnitId: true,
                geoUnit: {
                    select: {
                        name: true,
                        code: true,
                        children: { select: { id: true } } // Fetch children to count them
                    }
                },
                totalElectors: true,
                turnoutPercent: true,
                winningParty: true, // This returns the String name from schema line 281
                winningMargin: true,
                partyResults: {
                    orderBy: { voteCount: 'desc' },
                    take: 1,
                    select: {
                        party: { select: { colorHex: true, symbol: true } }
                    }
                }
            }
        }) as any[]; // TODO: Remove any cast and use proper mapped types

        // Get controversy density for all constituencies
        // Controversy = count of negative sentiment signals with high confidence in last 30 days
        const geoUnitIds = summaries.map(s => s.geoUnitId);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // For district level, we need to get controversies from child constituencies
        let controversyMap = new Map<number, number>();

        if (level && level.toString() === 'DISTRICT') {
            // Get all constituencies for these districts
            const allConstituencies = await this.prisma.geoUnit.findMany({
                where: {
                    parentId: { in: geoUnitIds },
                    level: 'CONSTITUENCY'
                },
                select: { id: true, parentId: true }
            });

            const constituencyIds = allConstituencies.map(c => c.id);

            // Get controversy data for constituencies
            const controversyData = await this.prisma.sentimentSignal.groupBy({
                by: ['geoUnitId'],
                where: {
                    geoUnitId: { in: constituencyIds },
                    sentiment: 'NEGATIVE',
                    confidence: { gte: 0.7 },
                    createdAt: { gte: thirtyDaysAgo }
                },
                _count: { id: true }
            });

            // Aggregate to district level
            const districtControversyMap = new Map<number, number>();
            controversyData.forEach(c => {
                const constituency = allConstituencies.find(ac => ac.id === c.geoUnitId);
                if (constituency && constituency.parentId) {
                    const current = districtControversyMap.get(constituency.parentId) || 0;
                    districtControversyMap.set(constituency.parentId, current + c._count.id);
                }
            });

            controversyMap = districtControversyMap;
        } else {
            // Constituency level - direct query
            const controversyData = await this.prisma.sentimentSignal.groupBy({
                by: ['geoUnitId'],
                where: {
                    geoUnitId: { in: geoUnitIds },
                    sentiment: 'NEGATIVE',
                    confidence: { gte: 0.7 },
                    createdAt: { gte: thirtyDaysAgo }
                },
                _count: { id: true }
            });

            controversyData.forEach(c => {
                controversyMap.set(c.geoUnitId, c._count.id);
            });
        }

        // Find max controversy count for normalization
        const maxControversy = Math.max(...Array.from(controversyMap.values()), 1);

        const result = summaries.map(s => {
            // Mock data for youth share (requires demographic data)
            const seed = s.geoUnitId * 9301 + 49297;
            const youthShare = (seed % 150) / 10 + 20; // 20.0 to 35.0

            // Actual controversy calculation
            const controversyCount = controversyMap.get(s.geoUnitId) || 0;
            const controversy = maxControversy > 0
                ? parseFloat((controversyCount / maxControversy).toFixed(2))
                : 0;

            return {
                constituencyId: s.geoUnitId,
                name: s.geoUnit.name,
                code: s.geoUnit.code,
                turnout: s.turnoutPercent,
                electors: s.totalElectors,
                seats: s.geoUnit.children?.length || 1,
                winner: s.winningParty,
                margin: s.winningMargin,
                color: s.partyResults[0]?.party?.colorHex || null,
                youth: parseFloat(youthShare.toFixed(1)),
                controversy: controversy,
                controversyCount: controversyCount // Include raw count for debugging
            };
        });

        // Cache for 10 mins
        await this.cacheService.set(cacheKey, result, 600);
        return result;
    }

    async getSubscribed(userId: number) {
        try {
            this.logger.debug(`Fetching subscribed constituencies for user #${userId}`);

            // Logic: User -> Subscription -> GeoAccess -> GeoUnit
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId },
                include: {
                    access: {
                        include: { geoUnit: true }
                    }
                }
            });

            if (!subscription) {
                this.logger.warn(`No subscription found for user #${userId}`);
                return [];
            }

            // Filter only CONSTITUENCY level units to avoid State/District appearing in dropdown
            const constituencies = subscription.access
                .filter(a => a.geoUnit.level === 'CONSTITUENCY')
                .map(a => ({
                    id: a.geoUnit.id,
                    name: a.geoUnit.name, // Ensure this is not concatenated in DB
                    number: a.geoUnit.code
                }));

            this.logger.debug(`Found ${constituencies.length} constituencies for user #${userId}`);
            return constituencies;
        } catch (error) {
            this.logger.error(`Error fetching subscribed constituencies for user #${userId}:`, error);
            throw error;
        }
    }
    async getConstituencyDetails(constituencyId: number, electionId?: string) {
        // Resolve election
        let eId = electionId ? parseInt(electionId) : undefined;
        if (!eId || isNaN(eId)) {
            const latest = await this.prisma.election.findFirst({ orderBy: { year: 'desc' } });
            eId = latest?.id;
        }

        if (!eId) return null;

        // Fetch margin summary
        const summary = await this.prisma.constituencyMarginSummary.findFirst({
            where: {
                geoUnitId: constituencyId,
                electionId: eId
            },
            include: {
                geoUnit: true,
                winningParty: true,
                runnerUpParty: true
            }
        });

        // Fetch candidates for this election/geoUnit
        const candidates = await this.prisma.electionResultRaw.findMany({
            where: {
                geoUnitId: constituencyId,
                electionId: eId
            },
            include: { candidate: true },
            orderBy: { votesTotal: 'desc' }
        });

        const winner = candidates[0];
        const runnerUp = candidates[1];

        // Fetch basic stats
        const geoSummary = await this.prisma.geoElectionSummary.findFirst({
            where: {
                electionId: eId,
                geoUnitId: constituencyId
            }
        });

        if (!summary || !geoSummary) return null;

        // Calculate real risks and opportunities
        const risks = await this.calculateRisks(constituencyId, eId);
        const opportunities = await this.calculateOpportunities(constituencyId, eId);

        return {
            id: geoSummary.geoUnitId,
            name: summary.geoUnit.name,
            code: summary.geoUnit.code,
            totalElectors: geoSummary.totalElectors,
            turnout: geoSummary.turnoutPercent,
            margin: summary.marginVotes,
            marginPercentage: summary.marginPercent,
            winner: {
                name: winner?.candidate.fullName || geoSummary.winningCandidate,
                party: summary.winningParty.name,
                partyColor: summary.winningParty.colorHex,
                votes: winner?.votesTotal || summary.winningVotes,
                votePercentage: winner ? parseFloat(((winner.votesTotal / geoSummary.totalVotesCast) * 100).toFixed(2)) : 0
            },
            runnerUp: {
                name: runnerUp?.candidate.fullName || "TBD",
                party: summary.runnerUpParty.name,
                partyColor: summary.runnerUpParty.colorHex,
                votes: runnerUp?.votesTotal || summary.runnerUpVotes,
                votePercentage: runnerUp ? parseFloat(((runnerUp.votesTotal / geoSummary.totalVotesCast) * 100).toFixed(2)) : 0
            },
            risks,
            opportunities
        };
    }

    /**
     * Calculate risks for a constituency based on sentiment and historical data
     */
    private async calculateRisks(constituencyId: number, electionId: number) {
        const risks: Array<{ type: string; severity: 'high' | 'medium' | 'low'; description: string }> = [];

        // Get sentiment data for last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const sentiments = await this.prisma.sentimentSignal.findMany({
            where: {
                geoUnitId: constituencyId,
                createdAt: { gte: thirtyDaysAgo }
            }
        });

        // Risk 1: Anti-Incumbency (based on negative sentiment)
        const negativeSentiments = sentiments.filter(s => s.sentiment === 'NEGATIVE');
        const negativeRatio = sentiments.length > 0 ? negativeSentiments.length / sentiments.length : 0;

        if (negativeRatio > 0.6) {
            risks.push({
                type: 'Anti-Incumbency',
                severity: 'high',
                description: `High negative sentiment (${(negativeRatio * 100).toFixed(0)}%) in recent news coverage suggests strong anti-incumbency.`
            });
        } else if (negativeRatio > 0.4) {
            risks.push({
                type: 'Anti-Incumbency',
                severity: 'medium',
                description: `Moderate negative sentiment (${(negativeRatio * 100).toFixed(0)}%) detected in constituency.`
            });
        }

        // Risk 2: Controversy Density
        const highConfidenceNegative = negativeSentiments.filter(s => s.confidence > 0.7);
        if (highConfidenceNegative.length > 5) {
            risks.push({
                type: 'Controversy',
                severity: 'high',
                description: `${highConfidenceNegative.length} high-impact controversies detected in the last 30 days.`
            });
        } else if (highConfidenceNegative.length > 2) {
            risks.push({
                type: 'Controversy',
                severity: 'medium',
                description: `${highConfidenceNegative.length} controversies reported recently.`
            });
        }

        // Risk 3: Narrow Margin (from election data)
        const margin = await this.prisma.constituencyMarginSummary.findFirst({
            where: { geoUnitId: constituencyId, electionId }
        });

        if (margin && margin.marginPercent < 5) {
            risks.push({
                type: 'Narrow Margin',
                severity: 'high',
                description: `Previous election won by only ${margin.marginPercent.toFixed(2)}% margin. Seat is highly competitive.`
            });
        } else if (margin && margin.marginPercent < 10) {
            risks.push({
                type: 'Narrow Margin',
                severity: 'medium',
                description: `Moderate margin of ${margin.marginPercent.toFixed(2)}% in last election. Requires strong campaign.`
            });
        }

        return risks.length > 0 ? risks : [{
            type: 'Low Risk',
            severity: 'low',
            description: 'No significant risks detected based on current data.'
        }];
    }

    /**
     * Calculate opportunities for a constituency
     */
    private async calculateOpportunities(constituencyId: number, electionId: number) {
        const opportunities: Array<{ type: string; impact: 'high' | 'medium' | 'low'; description: string }> = [];

        // Get sentiment data for last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const sentiments = await this.prisma.sentimentSignal.findMany({
            where: {
                geoUnitId: constituencyId,
                createdAt: { gte: thirtyDaysAgo }
            }
        });

        // Opportunity 1: Positive Sentiment Momentum
        const positiveSentiments = sentiments.filter(s => s.sentiment === 'POSITIVE');
        const positiveRatio = sentiments.length > 0 ? positiveSentiments.length / sentiments.length : 0;

        if (positiveRatio > 0.5) {
            opportunities.push({
                type: 'Positive Momentum',
                impact: 'high',
                description: `Strong positive sentiment (${(positiveRatio * 100).toFixed(0)}%) in recent coverage. Good time to amplify messaging.`
            });
        } else if (positiveRatio > 0.3) {
            opportunities.push({
                type: 'Positive Momentum',
                impact: 'medium',
                description: `Moderate positive sentiment (${(positiveRatio * 100).toFixed(0)}%). Build on current goodwill.`
            });
        }

        // Opportunity 2: High Engagement (based on news volume)
        if (sentiments.length > 20) {
            opportunities.push({
                type: 'High Media Attention',
                impact: 'high',
                description: `${sentiments.length} news articles in last 30 days. High visibility can be leveraged for campaign messaging.`
            });
        }

        // Opportunity 3: Turnout Potential
        const geoSummary = await this.prisma.geoElectionSummary.findFirst({
            where: { geoUnitId: constituencyId, electionId }
        });

        if (geoSummary && geoSummary.turnoutPercent < 70) {
            opportunities.push({
                type: 'Turnout Potential',
                impact: 'medium',
                description: `Previous turnout was ${geoSummary.turnoutPercent.toFixed(1)}%. Mobilizing non-voters could be decisive.`
            });
        }

        return opportunities.length > 0 ? opportunities : [{
            type: 'Stable Base',
            impact: 'low',
            description: 'Focus on maintaining current support levels.'
        }];
    }

    /**
     * Get opponents from last election for a given constituency
     * Used in settings to populate opponent dropdown
     */
    async getOpponents(constituencyId: number) {
        try {
            this.logger.debug(`Fetching opponents for constituency #${constituencyId}`);

            // Get the latest election for this constituency
            const latestElection = await this.prisma.electionResultRaw.findFirst({
                where: { geoUnitId: constituencyId },
                orderBy: { election: { year: 'desc' } },
                select: { electionId: true }
            });

            if (!latestElection) {
                this.logger.warn(`No election results found for constituency #${constituencyId}`);
                return [];
            }

            // Get all candidates from that election
            const candidates = await this.prisma.electionResultRaw.findMany({
                where: {
                    geoUnitId: constituencyId,
                    electionId: latestElection.electionId
                },
                include: {
                    candidate: true,
                    party: true
                },
                orderBy: { votesTotal: 'desc' }
            });

            const opponents = candidates.map(c => ({
                id: c.candidateId,
                name: c.candidate.fullName,
                party: c.party.name,
                partyColor: c.party.colorHex,
                votes: c.votesTotal,
                age: c.candidate.age,
                gender: c.candidate.gender
            }));

            this.logger.debug(`Found ${opponents.length} opponents for constituency #${constituencyId}`);
            return opponents;
        } catch (error) {
            this.logger.error(`Error fetching opponents for constituency #${constituencyId}:`, error);
            throw error;
        }
    }

    /**
     * Get district-level details with constituency breakdown
     * Used by DistrictProfileModal in frontend
     */
    async getDistrictDetails(districtName: string, electionId?: string) {
        try {
            this.logger.debug(`Fetching district details for ${districtName}`);

            // Resolve election ID
            let eId = electionId ? parseInt(electionId) : undefined;
            if (!eId || isNaN(eId)) {
                const latest = await this.prisma.election.findFirst({ orderBy: { year: 'desc' } });
                eId = latest?.id;
            }

            if (!eId) {
                this.logger.warn('No election found');
                return null;
            }

            // Find district by name
            const district = await this.prisma.geoUnit.findFirst({
                where: {
                    name: districtName,
                    level: 'DISTRICT'
                }
            });

            if (!district) {
                this.logger.warn(`District ${districtName} not found`);
                return null;
            }

            // Get all constituencies in this district
            const constituencies = await this.prisma.geoUnit.findMany({
                where: {
                    parentId: district.id,
                    level: 'CONSTITUENCY'
                }
            });

            const constituencyIds = constituencies.map(c => c.id);

            // Get election summaries for all constituencies
            const summaries = await this.prisma.geoElectionSummary.findMany({
                where: {
                    electionId: eId,
                    geoUnitId: { in: constituencyIds }
                },
                include: {
                    geoUnit: true
                }
            });

            // Get margin details for runner-up info
            const margins = await this.prisma.constituencyMarginSummary.findMany({
                where: {
                    electionId: eId,
                    geoUnitId: { in: constituencyIds }
                },
                include: {
                    runnerUpParty: true
                }
            });

            // Get winner candidate names
            const results = await this.prisma.electionResultRaw.findMany({
                where: {
                    electionId: eId,
                    geoUnitId: { in: constituencyIds }
                },
                include: {
                    candidate: true,
                    party: true
                },
                orderBy: { votesTotal: 'desc' }
            });

            // Group results by constituency (winner and runner-up)
            const resultsByConstituency = new Map<number, any[]>();
            results.forEach(r => {
                if (!resultsByConstituency.has(r.geoUnitId)) {
                    resultsByConstituency.set(r.geoUnitId, []);
                }
                resultsByConstituency.get(r.geoUnitId)!.push(r);
            });

            // Build constituency list
            const constituencyList = summaries.map(summary => {
                const margin = margins.find(m => m.geoUnitId === summary.geoUnitId);
                const constituencyResults = resultsByConstituency.get(summary.geoUnitId) || [];
                const winner = constituencyResults[0];
                const runnerUp = constituencyResults[1];

                return {
                    name: summary.geoUnit.name,
                    sittingMLA: winner?.candidate.fullName || summary.winningCandidate,
                    party: winner?.party.name || summary.winningParty,
                    margin: margin?.marginPercent || summary.winningMarginPct,
                    defeatedBy: runnerUp
                        ? `${runnerUp.candidate.fullName} (${runnerUp.party.name})`
                        : margin
                            ? `${margin.runnerUpParty.name} Candidate`
                            : 'N/A'
                };
            });

            // Calculate party-wise seat distribution
            const partyCounts: Record<string, number> = {};
            summaries.forEach(s => {
                const party = s.winningParty;
                partyCounts[party] = (partyCounts[party] || 0) + 1;
            });

            this.logger.debug(`Found ${constituencyList.length} constituencies in ${districtName}`);

            return {
                districtId: district.id,
                districtName: district.name,
                totalConstituencies: constituencies.length,
                constituencies: constituencyList,
                partyWiseSeats: partyCounts
            };
        } catch (error) {
            this.logger.error(`Error fetching district details for ${districtName}:`, error);
            throw error;
        }
    }
}


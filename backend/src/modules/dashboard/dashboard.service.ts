import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../common/services/cache.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GeoLevel } from '@prisma/client';

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(
        private readonly cacheService: CacheService,
        private readonly prisma: PrismaService,
    ) { }

    private async resolveElectionId(electionId?: string): Promise<number | undefined> {
        let targetElectionId = electionId ? parseInt(electionId) : undefined;

        if (!targetElectionId) {
            const latestElection = await this.prisma.election.findFirst({
                orderBy: { year: 'desc' },
            });
            if (latestElection) targetElectionId = latestElection.id;
        }
        return targetElectionId;
    }

    async getSummary(electionId?: string) {
        // Resolve latest election if not provided
        const targetElectionId = await this.resolveElectionId(electionId);
        if (!targetElectionId) {
            return {
                totalConstituencies: 0,
                totalElectors: 0,
                avgTurnout: 0,
                leadingPartySeats: 0,
                leadingParty: "N/A",
                oppositionPartySeats: 0,
                oppositionParty: "N/A",
                majority: 0,
                swing: null
            };
        }

        const cacheKey = CacheService.getDashboardSummaryKey(targetElectionId.toString(), 'all');
        const cached = await this.cacheService.get(cacheKey);
        if (cached) return cached;

        // Fetch basic aggregations
        const aggregations = await this.prisma.geoElectionSummary.aggregate({
            where: {
                electionId: targetElectionId,
                geoUnit: { level: 'CONSTITUENCY' }
            },
            _count: { id: true }, // Total constituencies
            _sum: {
                totalElectors: true,
                totalVotesCast: true
            }
        });

        const seatSummary = await this.prisma.electionSeatSummary.findFirst({
            where: { electionId: targetElectionId }
        });

        const totalConstituencies = aggregations._count.id;
        const totalElectors = aggregations._sum.totalElectors || 0;
        const totalVotes = aggregations._sum.totalVotesCast || 0;
        const avgTurnout = totalElectors > 0 ? (totalVotes / totalElectors) * 100 : 0;

        // Fetch Seat Counts for top parties
        const partySeats = await this.prisma.partySeatSummary.findMany({
            where: { electionId: targetElectionId },
            include: { party: true },
            orderBy: { seatsWon: 'desc' },
            take: 2
        });

        const leadingParty = partySeats[0];
        const oppositionParty = partySeats[1];

        // Calculate Swing (Vote Share Change for Leading Party from last election)
        let swing = null;
        try {
            const currentElection = await this.prisma.election.findUnique({
                where: { id: targetElectionId }
            });

            if (currentElection && leadingParty) {
                // Get previous election
                const previousElection = await this.prisma.election.findFirst({
                    where: {
                        year: { lt: currentElection.year },
                        type: currentElection.type
                    },
                    orderBy: { year: 'desc' }
                });

                if (previousElection) {
                    // Get current vote share for winning party
                    const currentVoteShare = await this.prisma.partyVoteSummary.aggregate({
                        where: {
                            partyId: leadingParty.partyId,
                            summary: {
                                electionId: targetElectionId,
                                geoUnit: { level: 'CONSTITUENCY' }
                            }
                        },
                        _avg: { voteSharePercent: true }
                    });

                    // Get previous vote share for winning party
                    const previousVoteShare = await this.prisma.partyVoteSummary.aggregate({
                        where: {
                            partyId: leadingParty.partyId,
                            summary: {
                                electionId: previousElection.id,
                                geoUnit: { level: 'CONSTITUENCY' }
                            }
                        },
                        _avg: { voteSharePercent: true }
                    });

                    const currentShare = currentVoteShare._avg.voteSharePercent || 0;
                    const previousShare = previousVoteShare._avg.voteSharePercent || 0;
                    const diff = currentShare - previousShare;

                    const sign = diff > 0 ? "+" : "";
                    swing = `${sign}${diff.toFixed(2)}% Vote Share`; // e.g. "+5.23% Vote Share"
                }
            }
        } catch (e) {
            this.logger.error('Error calculating swing:', e);
            // Ignore swing calc errors
        }

        const result = {
            totalConstituencies,
            totalElectors,
            avgTurnout: parseFloat(avgTurnout.toFixed(2)),
            leadingPartySeats: leadingParty?.seatsWon || 0,
            leadingParty: leadingParty?.party?.name,
            oppositionPartySeats: oppositionParty?.seatsWon || 0,
            oppositionParty: oppositionParty?.party?.name,
            majority: seatSummary?.majorityMark || 0,
            swing: swing,
        };

        await this.cacheService.set(cacheKey, result, 300); // 5 mins
        return result;
    }

    async getPartyStats(electionId: string) {
        if (!electionId) return [];
        const eId = parseInt(electionId);

        const cacheKey = CacheService.getPartyStatsKey(electionId);
        const cached = await this.cacheService.get(cacheKey);
        if (cached) return cached;

        const partyStats = await this.prisma.partySeatSummary.findMany({
            where: { electionId: eId },
            include: { party: true },
            orderBy: { seatsWon: 'desc' }
        });

        // Get vote share data for each party
        const result = await Promise.all(partyStats.map(async (stat) => {
            // Aggregate votes and vote share across all constituencies
            const voteData = await this.prisma.partyVoteSummary.aggregate({
                where: {
                    partyId: stat.partyId,
                    summary: {
                        electionId: eId,
                        geoUnit: { level: 'CONSTITUENCY' }
                    }
                },
                _sum: {
                    voteCount: true
                },
                _avg: {
                    voteSharePercent: true
                }
            });

            return {
                partyId: stat.partyId,
                name: stat.party.name,
                code: stat.party.symbol || stat.party.name.substring(0, 3).toUpperCase(),
                seats: stat.seatsWon,
                votes: voteData._sum.voteCount || 0,
                voteSharePercent: parseFloat((voteData._avg.voteSharePercent || 0).toFixed(2)),
                color: stat.party.colorHex || '#ccc'
            };
        }));

        await this.cacheService.set(cacheKey, result, 300);
        return result;
    }
    async getHistoricalStats() {
        const cacheKey = 'dashboard:historical-stats';
        const cached = await this.cacheService.get(cacheKey);
        if (cached) return cached;

        const elections = await this.prisma.election.findMany({
            orderBy: { year: 'asc' },
            include: {
                seatSummaries: {
                    include: { party: true }
                }
            }
        });

        const partyColors: Record<string, string> = {};

        // Transform into { year: "2013", INC: 122, BJP: 40... }
        const stats = elections.map(e => {
            const entry: any = { year: e.year.toString() };
            e.seatSummaries.forEach(s => {
                const partyName = s.party.name;
                entry[partyName] = s.seatsWon;

                // Capture color for the party
                if (!partyColors[partyName]) {
                    partyColors[partyName] = s.party.colorHex || '#ccc';
                }
            });
            return entry;
        });

        const result = {
            stats,
            colors: partyColors
        };

        await this.cacheService.set(cacheKey, result, 3600);
        return result;
    }

    async getReligionDistribution(geoUnitId: number, year?: number) {
        if (!geoUnitId) {
            return [];
        }

        // Determine target year: use provided year or latest available for this geo unit
        let targetYear = year;

        if (!targetYear) {
            const latest = await this.prisma.geoReligionStat.findFirst({
                where: { geoUnitId },
                orderBy: { year: 'desc' },
            });

            if (!latest) {
                return [];
            }

            targetYear = latest.year;
        }

        const cacheKey = `dashboard:religion:${geoUnitId}:${targetYear}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached) return cached;

        const stats = await this.prisma.geoReligionStat.findMany({
            where: {
                geoUnitId,
                year: targetYear,
            },
            orderBy: { religion: 'asc' },
        });

        if (!stats || stats.length === 0) {
            return [];
        }

        const totalPopulation = stats.reduce((sum, s) => sum + (s.population || 0), 0);

        const result = stats.map((s) => {
            const percent =
                s.percent != null
                    ? parseFloat(s.percent.toFixed(2))
                    : totalPopulation > 0
                        ? parseFloat(((s.population / totalPopulation) * 100).toFixed(2))
                        : 0;

            return {
                religion: s.religion,
                population: s.population,
                percent,
                year: s.year,
            };
        });

        await this.cacheService.set(cacheKey, result, 600);
        return result;
    }
}

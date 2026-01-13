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

    async getSummary(electionId?: string, stateId?: string) {
        // 1. Resolve Election ID (default to latest Assembly election if not provided)
        // For now assuming we have a way to get the "latest" election. 
        // If not provided, we should probably fetch the most recent one.
        // Converting string IDs to numbers as Prisma uses Int IDs.

        const cacheKey = CacheService.getDashboardSummaryKey(
            electionId || 'latest',
            stateId || 'all',
        );
        const cached = await this.cacheService.get(cacheKey);
        if (cached) return cached;

        // TODO: proper election resolution logic. For now, picking the latest distinct election from results.
        let targetElectionId = electionId ? parseInt(electionId) : undefined;

        if (!targetElectionId) {
            const latestElection = await this.prisma.election.findFirst({
                orderBy: { year: 'desc' },
            });
            if (latestElection) targetElectionId = latestElection.id;
        }

        if (!targetElectionId) {
            return { error: "No election data found" };
        }

        // Fetch Seat Summary
        const seatSummary = await this.prisma.electionSeatSummary.findUnique({
            where: { electionId: targetElectionId },
            include: { winningParty: true }
        });

        // Fetch Aggregates if not pre-calculated
        // For "Total Electors", "Avg Turnout", etc. we can aggregate from GeoElectionSummary
        const aggregations = await this.prisma.geoElectionSummary.aggregate({
            where: { electionId: targetElectionId },
            _sum: {
                totalElectors: true,
                totalVotesCast: true,
            },
            _count: {
                geoUnitId: true
            }
        });

        const totalConstituencies = aggregations._count.geoUnitId;
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

        const result = {
            totalConstituencies,
            totalElectors,
            avgTurnout: parseFloat(avgTurnout.toFixed(2)),
            leadingPartySeats: leadingParty?.seatsWon || 0,
            leadingParty: leadingParty?.party?.name,
            oppositionPartySeats: oppositionParty?.seatsWon || 0,
            oppositionParty: oppositionParty?.party?.name,
            majority: seatSummary?.majorityMark || 0,
            // "Swing" would need historical data comparison, keeping simple for now
            swing: "+0.0%",
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

        const result = partyStats.map(stat => ({
            partyId: stat.partyId,
            name: stat.party.name,
            code: stat.party.symbol || stat.party.name.substring(0, 3).toUpperCase(),
            seats: stat.seatsWon,
            color: stat.party.colorHex || '#ccc'
            // voteShare would come from PartyVoteSummary aggregation if needed
        }));

        await this.cacheService.set(cacheKey, result, 300);
        return result;
    }
}

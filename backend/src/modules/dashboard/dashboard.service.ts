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

        // Calculate Swing (Seat Change for Leading Party)
        let swing = null;
        try {
            const history = await this.getHistoricalStats() as any[];
            // Find current election year from ID
            const currentElection = await this.prisma.election.findUnique({
                where: { id: targetElectionId }
            });

            if (currentElection && leadingParty) {
                // Sort history by year just in case
                const sortedHistory = history.sort((a: any, b: any) => parseInt(a.year) - parseInt(b.year));
                const currentIndex = sortedHistory.findIndex((h: any) => h.year == currentElection.year);

                if (currentIndex > 0) {
                    const currentStats = sortedHistory[currentIndex];
                    const prevStats = sortedHistory[currentIndex - 1];
                    const partyName = leadingParty.party.name; // e.g. "INC"

                    // Historical stats keys are party names
                    const currentSeats = currentStats[partyName] || 0;
                    const prevSeats = prevStats[partyName] || 0;
                    // If currentStats has logic different from partySeatSummary, use what we have in hand (partySeats[0].seatsWon)
                    // But assume historical covers it.

                    const diff = (leadingParty.seatsWon) - prevSeats; // Use actual current seats
                    const sign = diff > 0 ? "+" : "";
                    swing = `${sign}${diff} Seats`; // e.g. "+55 Seats"
                }
            }
        } catch (e) {
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
    async getHistoricalStats() {
        const cacheKey = 'dashboard:historical-stats';
        const cached = await this.cacheService.get(cacheKey);
        if (cached) return cached;

        const elections = await this.prisma.election.findMany({
            orderBy: { year: 'asc' },
            include: { seatSummaries: { include: { party: true } } }
        });

        // Transform into { year: "2013", INC: 122, BJP: 40... }
        const result = elections.map(e => {
            const entry: any = { year: e.year.toString() };
            e.seatSummaries.forEach(s => {
                const partyCode = s.party.symbol ? s.party.name : s.party.name;
                // Using name for consistency with frontend expectations (INC, BJP)
                entry[partyCode] = s.seatsWon;
            });
            return entry;
        });

        await this.cacheService.set(cacheKey, result, 3600);
        return result;
    }
}

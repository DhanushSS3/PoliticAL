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

        const result = summaries.map(s => ({
            constituencyId: s.geoUnitId,
            name: s.geoUnit.name,
            code: s.geoUnit.code,
            turnout: s.turnoutPercent,
            electors: s.totalElectors,
            seats: s.geoUnit.children?.length || 1, // District has children, Constituency is 1
            winner: s.winningParty,
            margin: s.winningMargin,
            color: s.partyResults[0]?.party?.colorHex || null
        }));

        // Cache for 10 mins
        await this.cacheService.set(cacheKey, result, 600);
        return result;
    }

    async getSubscribed(userId: number) {
        // Logic: User -> Subscription -> GeoAccess -> GeoUnit
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
            include: {
                access: {
                    include: { geoUnit: true }
                }
            }
        });

        if (!subscription) return [];

        return subscription.access.map(a => ({
            id: a.geoUnit.id,
            name: a.geoUnit.name,
            number: a.geoUnit.code
        }));
    }
    async getDistrictDetails(districtName: string, electionId: string) {
        // Resolve election
        let eId = electionId ? parseInt(electionId) : undefined;
        if (!eId || isNaN(eId)) {
            const latest = await this.prisma.election.findFirst({ orderBy: { year: 'desc' } });
            eId = latest?.id;
        }

        if (!eId) return { constituencies: [] };

        const summaries = await this.prisma.geoElectionSummary.findMany({
            where: {
                electionId: eId,
                geoUnit: {
                    level: 'CONSTITUENCY', // Constituencies
                    parent: {
                        // Use OR condition for common spelling variations
                        OR: [
                            { name: districtName },
                            { name: { contains: districtName } },
                            // Specific fix for Davanagere vs Davangere
                            { name: districtName === 'Davanagere' ? 'Davangere' : districtName },
                            { name: districtName === 'Davangere' ? 'Davanagere' : districtName },
                            { name: districtName === 'Vijayanagara' ? 'Vijayanagar' : districtName },
                            { name: districtName === 'Vijayanagar' ? 'Vijayanagara' : districtName },
                            { name: districtName === 'Chikkamagaluru' ? 'Chikmagalur' : districtName },
                            { name: districtName === 'Chikmagalur' ? 'Chikkamagaluru' : districtName },
                            { name: districtName === 'Shivamogga' ? 'Shimoga' : districtName },
                            { name: districtName === 'Shimoga' ? 'Shivamogga' : districtName },
                            { name: districtName === 'Kalaburagi' ? 'Gulbarga' : districtName },
                            { name: districtName === 'Gulbarga' ? 'Kalaburagi' : districtName },
                            { name: districtName === 'Belagavi' ? 'Belgaum' : districtName },
                            { name: districtName === 'Belgaum' ? 'Belagavi' : districtName },
                            { name: districtName === 'Mysuru' ? 'Mysore' : districtName },
                            { name: districtName === 'Mysore' ? 'Mysuru' : districtName },
                            { name: districtName === 'Bengaluru Urban' ? 'Bangalore Urban' : districtName },
                            { name: districtName === 'Bangalore Urban' ? 'Bengaluru Urban' : districtName }
                        ]
                    }
                }
            },
            select: {
                geoUnit: { select: { name: true } },
                winningCandidate: true,
                winningParty: true,
                winningMargin: true,
                winningMarginPct: true,
                // We need runner up info. This is tricky with current schema summary.
                // We'll use ConstituencyMarginSummary which has explicit winner/runner-up
            }
        });

        // Better Approach using Margin Summary for details
        const details = await this.prisma.constituencyMarginSummary.findMany({
            where: {
                electionId: eId,
                geoUnit: {
                    parent: {
                        OR: [
                            { name: districtName },
                            { name: { contains: districtName } },
                            { name: districtName === 'Davanagere' ? 'Davangere' : districtName },
                            { name: districtName === 'Davangere' ? 'Davanagere' : districtName },
                            { name: districtName === 'Vijayanagara' ? 'Vijayanagar' : districtName },
                            { name: districtName === 'Vijayanagar' ? 'Vijayanagara' : districtName },
                            { name: districtName === 'Chikkamagaluru' ? 'Chikmagalur' : districtName },
                            { name: districtName === 'Chikmagalur' ? 'Chikkamagaluru' : districtName },
                            { name: districtName === 'Shivamogga' ? 'Shimoga' : districtName },
                            { name: districtName === 'Shimoga' ? 'Shivamogga' : districtName },
                            { name: districtName === 'Kalaburagi' ? 'Gulbarga' : districtName },
                            { name: districtName === 'Gulbarga' ? 'Kalaburagi' : districtName },
                            { name: districtName === 'Belagavi' ? 'Belgaum' : districtName },
                            { name: districtName === 'Belgaum' ? 'Belagavi' : districtName },
                            { name: districtName === 'Mysuru' ? 'Mysore' : districtName },
                            { name: districtName === 'Mysore' ? 'Mysuru' : districtName },
                            { name: districtName === 'Bengaluru Urban' ? 'Bangalore Urban' : districtName },
                            { name: districtName === 'Bangalore Urban' ? 'Bengaluru Urban' : districtName }
                        ]
                    }
                }
            },
            include: {
                geoUnit: true,
                winningParty: true,
                runnerUpParty: true,
            }
        });

        // Create a map of winner names from geoElectionSummary
        const winnerMap = new Map<string, string>();
        summaries.forEach(s => {
            if (s.geoUnit?.name && s.winningCandidate) {
                winnerMap.set(s.geoUnit.name, s.winningCandidate);
            }
        });

        // Map to frontend expectation
        return {
            constituencies: details.map(d => ({
                name: d.geoUnit.name,
                sittingMLA: winnerMap.get(d.geoUnit.name) || "Unknown",
                party: d.winningParty.name,
                margin: parseFloat(d.marginPercent.toFixed(2)),
                defeatedBy: `Candidate from ${d.runnerUpParty.name}`, // Placeholder for name
            }))
        };
    }
}

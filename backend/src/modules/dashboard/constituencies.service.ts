import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/services/cache.service';

@Injectable()
export class ConstituenciesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) { }

    async getMapData(electionId: string, metric: string = 'turnout') {
        const cacheKey = CacheService.getConstituencyMapKey(electionId);
        const cached = await this.cacheService.get(cacheKey);
        // if (cached) return cached; // caching disabled for dev iteration

        const eId = parseInt(electionId);

        // Fetch summaries with winner info
        // explicit casting to avoid type inference issues with complex selects in some prisma versions
        const summaries = await this.prisma.geoElectionSummary.findMany({
            where: {
                electionId: eId,
                geoUnit: { level: 'CONSTITUENCY' }
            },
            select: {
                geoUnitId: true,
                geoUnit: { select: { name: true, code: true } },
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
            winner: s.winningParty,
            margin: s.winningMargin,
            color: s.partyResults[0]?.party?.colorHex || '#ccc'
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
}

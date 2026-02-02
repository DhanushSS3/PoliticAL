import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/services/cache.service';
export declare class NewsIntelligenceService {
    private readonly prisma;
    private readonly cacheService;
    private readonly logger;
    constructor(prisma: PrismaService, cacheService: CacheService);
    private validateGeoAccess;
    private getUserAccessibleGeoUnits;
    private resolveGeoUnitId;
    getProjectedWinner(geoUnitId?: string | number, userId?: number): Promise<unknown>;
    getControversies(geoUnitId?: string | number, days?: number, limit?: number, userId?: number): Promise<unknown>;
    getHeadToHead(candidate1Id: number, candidate2Id: number, days?: number, userId?: number): Promise<unknown>;
    getNewsImpact(geoUnitId?: string | number, days?: number, userId?: number): Promise<unknown>;
    getLiveFeed(geoUnitId?: string | number, partyId?: number, limit?: number, userId?: number): Promise<unknown>;
    getDashboardSentiment(days?: number, partyLimit?: number): Promise<unknown>;
    getDashboardNewsImpact(days?: number, partyLimit?: number): Promise<unknown>;
    private getPartyWave;
    private calculateTrend;
    private getCandidateSentiment;
    private formatRelativeTime;
    private calculateVirality;
}

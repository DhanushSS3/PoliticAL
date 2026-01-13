import { CacheService } from '../../common/services/cache.service';
import { PrismaService } from '../../prisma/prisma.service';
export declare class DashboardService {
    private readonly cacheService;
    private readonly prisma;
    private readonly logger;
    constructor(cacheService: CacheService, prisma: PrismaService);
    getSummary(electionId?: string, stateId?: string): Promise<unknown>;
    getPartyStats(electionId: string): Promise<unknown>;
}

import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/services/cache.service';
export declare class ConstituenciesService {
    private readonly prisma;
    private readonly cacheService;
    constructor(prisma: PrismaService, cacheService: CacheService);
    getMapData(electionId: string, metric?: string): Promise<{
        constituencyId: any;
        name: any;
        code: any;
        turnout: any;
        winner: any;
        margin: any;
        color: any;
    }[]>;
    getSubscribed(userId: number): Promise<{
        id: number;
        name: string;
        number: string;
    }[]>;
}

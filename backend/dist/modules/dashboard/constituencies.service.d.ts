import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/services/cache.service';
export declare class ConstituenciesService {
    private readonly prisma;
    private readonly cacheService;
    private readonly logger;
    constructor(prisma: PrismaService, cacheService: CacheService);
    getMapData(electionId: string, metric?: string, level?: 'CONSTITUENCY' | 'DISTRICT'): Promise<{
        constituencyId: any;
        name: any;
        code: any;
        turnout: any;
        electors: any;
        seats: any;
        winner: any;
        margin: any;
        color: any;
    }[]>;
    getSubscribed(userId: number): Promise<{
        id: number;
        name: string;
        number: string;
    }[]>;
    getDistrictDetails(districtName: string, electionId: string): Promise<{
        constituencies: {
            name: string;
            sittingMLA: string;
            party: string;
            margin: number;
            defeatedBy: string;
        }[];
    }>;
}

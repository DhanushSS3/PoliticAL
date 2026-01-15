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
        turnout: number;
        electors: any;
        seats: any;
        winner: any;
        margin: number;
        color: any;
    }[] | {
        constituencyId: any;
        name: any;
        code: any;
        turnout: any;
        electors: any;
        seats: any;
        winner: any;
        margin: any;
        color: any;
        youth: number;
        controversy: number;
    }[]>;
    getSubscribed(userId: number): Promise<{
        id: number;
        name: string;
        number: string;
    }[]>;
    getConstituencyDetails(constituencyId: number, electionId?: string): Promise<{
        id: number;
        name: string;
        code: string;
        totalElectors: number;
        turnout: number;
        margin: number;
        marginPercentage: number;
        winner: {
            name: string;
            party: string;
            partyColor: string;
            votes: number;
            votePercentage: number;
        };
        runnerUp: {
            name: string;
            party: string;
            partyColor: string;
            votes: number;
            votePercentage: number;
        };
        risks: {
            type: string;
            severity: string;
            description: string;
        }[];
    }>;
    getOpponents(constituencyId: number): Promise<{
        id: number;
        name: string;
        party: string;
        partyColor: string;
        votes: number;
        age: number;
        gender: string;
    }[]>;
}

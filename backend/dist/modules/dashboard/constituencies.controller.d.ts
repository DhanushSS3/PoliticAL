import { ConstituenciesService } from './constituencies.service';
export declare class ConstituenciesController {
    private readonly constituenciesService;
    constructor(constituenciesService: ConstituenciesService);
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
    getSubscribed(userId: string): Promise<{
        id: number;
        name: string;
        number: string;
    }[]>;
}

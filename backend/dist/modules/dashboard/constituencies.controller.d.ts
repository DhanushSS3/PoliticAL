import { ConstituenciesService } from './constituencies.service';
export declare class ConstituenciesController {
    private readonly constituenciesService;
    constructor(constituenciesService: ConstituenciesService);
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
    getSubscribed(userId: string): Promise<{
        id: number;
        name: string;
        number: string;
    }[]>;
    getDistrictDetails(district: string, electionId: string): Promise<{
        constituencies: {
            name: string;
            sittingMLA: string;
            party: string;
            margin: number;
            defeatedBy: string;
        }[];
    }>;
}

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
        controversyCount: number;
    }[]>;
    getSubscribed(userId: string): Promise<{
        id: number;
        name: string;
        number: string;
    }[]>;
    getDetails(constituencyId: string, electionId: string): Promise<{
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
    getOpponents(constituencyId: string): Promise<{
        id: number;
        name: string;
        party: string;
        partyColor: string;
        votes: number;
        age: number;
        gender: string;
    }[]>;
    getDistrictDetails(district: string, electionId?: string): Promise<{
        districtId: number;
        districtName: string;
        totalConstituencies: number;
        constituencies: {
            name: string;
            sittingMLA: any;
            party: any;
            margin: number;
            defeatedBy: string;
        }[];
        partyWiseSeats: Record<string, number>;
    }>;
}

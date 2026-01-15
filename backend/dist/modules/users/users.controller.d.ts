import { UsersService } from "./users.service";
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getProfile(req: any): Promise<{
        id: any;
        fullName: any;
        email: any;
        phone: any;
        role: any;
        profilePhoto: any;
        candidate: {
            id: any;
            name: any;
            party: any;
            partyColor: any;
        };
        opponent: {
            id: any;
            name: any;
            party: any;
            partyColor: any;
        };
    }>;
    updateProfile(req: any, body: {
        profilePhoto?: string;
    }): Promise<{
        id: any;
        fullName: any;
        email: any;
        phone: any;
        role: any;
        profilePhoto: any;
        candidate: {
            id: any;
            name: any;
            party: any;
            partyColor: any;
        };
        opponent: {
            id: any;
            name: any;
            party: any;
            partyColor: any;
        };
    }>;
    updateOpponent(req: any, body: {
        opponentId: number;
    }): Promise<{
        id: any;
        fullName: any;
        email: any;
        phone: any;
        role: any;
        profilePhoto: any;
        candidate: {
            id: any;
            name: any;
            party: any;
            partyColor: any;
        };
        opponent: {
            id: any;
            name: any;
            party: any;
            partyColor: any;
        };
    }>;
    getOpponentCandidates(req: any): Promise<{
        id: any;
        name: any;
        party: any;
        partyColor: any;
    }[]>;
}

import { PrismaService } from "../../prisma/prisma.service";
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getProfile(userId: number): Promise<{
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
    updateProfile(userId: number, data: {
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
    updateOpponent(userId: number, opponentId: number): Promise<{
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
    getOpponentCandidates(userId: number): Promise<{
        id: any;
        name: any;
        party: any;
        partyColor: any;
    }[]>;
}

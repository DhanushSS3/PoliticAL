import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    async getProfile(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                candidateProfile: {
                    include: {
                        candidate: {
                            include: {
                                party: true,
                            },
                        },
                        opponent: {
                            include: {
                                party: true,
                            },
                        },
                    } as any,
                },
            },
        }) as any;

        if (!user) {
            throw new NotFoundException("User not found");
        }

        return {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            profilePhoto: user.profilePhoto,
            candidate: user.candidateProfile
                ? {
                    id: user.candidateProfile.candidate.id,
                    name: user.candidateProfile.candidate.fullName,
                    party: user.candidateProfile.candidate.party.name,
                    partyColor: user.candidateProfile.candidate.party.colorHex,
                }
                : null,
            opponent: user.candidateProfile?.opponent
                ? {
                    id: user.candidateProfile.opponent.id,
                    name: user.candidateProfile.opponent.fullName,
                    party: user.candidateProfile.opponent.party.name,
                    partyColor: user.candidateProfile.opponent.party.colorHex,
                }
                : null,
        };
    }

    async updateProfile(userId: number, data: { profilePhoto?: string }) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                profilePhoto: data.profilePhoto,
            },
        }) as any;

        return this.getProfile(userId);
    }

    async updateOpponent(userId: number, opponentId: number) {
        // Get user's candidate profile
        const profile = await this.prisma.candidateProfile.findFirst({
            where: { userId },
        }) as any;

        if (!profile) {
            throw new NotFoundException("Candidate profile not found");
        }

        // Update opponent
        await this.prisma.candidateProfile.update({
            where: { candidateId: profile.candidateId },
            data: { opponentId },
        });

        return this.getProfile(userId);
    }

    async getOpponentCandidates(userId: number) {
        // Get user's candidate profile
        const profile = await this.prisma.candidateProfile.findFirst({
            where: { userId },
            include: { geoUnit: true },
        }) as any;

        if (!profile) {
            return [];
        }

        // Get all candidates in the same constituency except self
        const candidates = await this.prisma.candidateProfile.findMany({
            where: {
                primaryGeoUnitId: profile.primaryGeoUnitId,
                candidateId: { not: profile.candidateId },
            },
            include: {
                candidate: {
                    include: {
                        party: true,
                    },
                },
            },
        }) as any[];

        return candidates.map((c) => ({
            id: c.candidate.id,
            name: c.candidate.fullName,
            party: c.candidate.party.name,
            partyColor: c.candidate.party.colorHex,
        }));
    }
}


"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let UsersService = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getProfile(userId) {
        var _a;
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
                    },
                },
            },
        });
        if (!user) {
            throw new common_1.NotFoundException("User not found");
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
            opponent: ((_a = user.candidateProfile) === null || _a === void 0 ? void 0 : _a.opponent)
                ? {
                    id: user.candidateProfile.opponent.id,
                    name: user.candidateProfile.opponent.fullName,
                    party: user.candidateProfile.opponent.party.name,
                    partyColor: user.candidateProfile.opponent.party.colorHex,
                }
                : null,
        };
    }
    async updateProfile(userId, data) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                profilePhoto: data.profilePhoto,
            },
        });
        return this.getProfile(userId);
    }
    async updateOpponent(userId, opponentId) {
        const profile = await this.prisma.candidateProfile.findFirst({
            where: { userId },
        });
        if (!profile) {
            throw new common_1.NotFoundException("Candidate profile not found");
        }
        await this.prisma.candidateProfile.update({
            where: { candidateId: profile.candidateId },
            data: { opponentId },
        });
        return this.getProfile(userId);
    }
    async getOpponentCandidates(userId) {
        const profile = await this.prisma.candidateProfile.findFirst({
            where: { userId },
            include: { geoUnit: true },
        });
        if (!profile) {
            return [];
        }
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
        });
        return candidates.map((c) => ({
            id: c.candidate.id,
            name: c.candidate.fullName,
            party: c.candidate.party.name,
            partyColor: c.candidate.party.colorHex,
        }));
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map
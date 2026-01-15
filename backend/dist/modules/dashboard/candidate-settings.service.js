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
var CandidateSettingsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandidateSettingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
let CandidateSettingsService = CandidateSettingsService_1 = class CandidateSettingsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(CandidateSettingsService_1.name);
    }
    async updateOpponent(candidateId, opponentId) {
        this.logger.log(`Updating opponent for candidate #${candidateId} to #${opponentId}`);
        const candidate = await this.prisma.candidateProfile.findUnique({
            where: { candidateId }
        });
        if (!candidate) {
            throw new common_1.BadRequestException(`Candidate profile #${candidateId} not found`);
        }
        const opponent = await this.prisma.candidate.findUnique({
            where: { id: opponentId }
        });
        if (!opponent) {
            throw new common_1.BadRequestException(`Opponent candidate #${opponentId} not found`);
        }
        await this.prisma.candidateProfile.update({
            where: { candidateId },
            data: { opponentId }
        });
        const candidateMonitoring = await this.prisma.entityMonitoring.findUnique({
            where: {
                entityType_entityId: {
                    entityType: client_1.EntityType.CANDIDATE,
                    entityId: candidateId
                }
            }
        });
        if (candidateMonitoring) {
            await this.prisma.entityMonitoring.upsert({
                where: {
                    entityType_entityId: {
                        entityType: client_1.EntityType.CANDIDATE,
                        entityId: opponentId
                    }
                },
                create: {
                    entityType: client_1.EntityType.CANDIDATE,
                    entityId: opponentId,
                    isActive: true,
                    priority: candidateMonitoring.priority,
                    reason: 'SELECTED_OPPONENT',
                    triggeredByCandidateId: candidateId
                },
                update: {
                    priority: candidateMonitoring.priority,
                    reason: 'SELECTED_OPPONENT',
                    isActive: true
                }
            });
        }
        this.logger.log(`✅ Updated opponent for candidate #${candidateId}`);
        return { success: true, opponentId };
    }
    async updateProfilePhoto(candidateId, photoPath) {
        this.logger.log(`Updating profile photo for candidate #${candidateId}`);
        await this.prisma.candidateProfile.update({
            where: { candidateId },
            data: { profilePhotoPath: photoPath }
        });
        return { success: true, photoPath };
    }
    async updateProfileText(candidateId, textPath) {
        this.logger.log(`Updating profile text for candidate #${candidateId}`);
        await this.prisma.candidateProfile.update({
            where: { candidateId },
            data: { profileTextPath: textPath }
        });
        return { success: true, textPath };
    }
    async updateOpponentProfilePhoto(candidateId, photoPath) {
        this.logger.log(`Updating opponent profile photo for candidate #${candidateId}`);
        await this.prisma.candidateProfile.update({
            where: { candidateId },
            data: { opponentProfilePhotoPath: photoPath }
        });
        return { success: true, photoPath };
    }
    async updateOpponentProfileText(candidateId, textPath) {
        this.logger.log(`Updating opponent profile text for candidate #${candidateId}`);
        await this.prisma.candidateProfile.update({
            where: { candidateId },
            data: { opponentProfileTextPath: textPath }
        });
        return { success: true, textPath };
    }
    async getSettings(candidateId) {
        const profile = await this.prisma.candidateProfile.findUnique({
            where: { candidateId },
            include: {
                candidate: true,
                geoUnit: true,
                party: true,
                opponent: {
                    include: {
                        party: true
                    }
                }
            }
        });
        if (!profile) {
            throw new common_1.BadRequestException(`Candidate profile #${candidateId} not found`);
        }
        return {
            candidateId: profile.candidateId,
            candidateName: profile.candidate.fullName,
            constituency: {
                id: profile.geoUnit.id,
                name: profile.geoUnit.name,
                code: profile.geoUnit.code
            },
            party: {
                id: profile.party.id,
                name: profile.party.name,
                symbol: profile.party.symbol
            },
            profilePhotoPath: profile.profilePhotoPath,
            profileTextPath: profile.profileTextPath,
            opponent: profile.opponent ? {
                id: profile.opponent.id,
                name: profile.opponent.fullName,
                party: profile.opponent.party.name,
                profilePhotoPath: profile.opponentProfilePhotoPath,
                profileTextPath: profile.opponentProfileTextPath
            } : null
        };
    }
};
exports.CandidateSettingsService = CandidateSettingsService;
exports.CandidateSettingsService = CandidateSettingsService = CandidateSettingsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CandidateSettingsService);
//# sourceMappingURL=candidate-settings.service.js.map
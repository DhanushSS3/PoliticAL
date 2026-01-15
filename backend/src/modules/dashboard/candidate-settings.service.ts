import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntityType } from '@prisma/client';

/**
 * CandidateSettingsService
 * Handles candidate profile updates including opponent selection and profile photos
 */
@Injectable()
export class CandidateSettingsService {
    private readonly logger = new Logger(CandidateSettingsService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Update candidate's selected opponent
     * This also updates the opponent's monitoring priority to match the candidate's
     */
    async updateOpponent(candidateId: number, opponentId: number) {
        this.logger.log(`Updating opponent for candidate #${candidateId} to #${opponentId}`);

        // Verify both candidates exist
        const candidate = await this.prisma.candidateProfile.findUnique({
            where: { candidateId }
        });

        if (!candidate) {
            throw new BadRequestException(`Candidate profile #${candidateId} not found`);
        }

        const opponent = await this.prisma.candidate.findUnique({
            where: { id: opponentId }
        });

        if (!opponent) {
            throw new BadRequestException(`Opponent candidate #${opponentId} not found`);
        }

        // Update candidate profile with selected opponent
        await this.prisma.candidateProfile.update({
            where: { candidateId },
            data: { opponentId }
        });

        // Update opponent's monitoring priority to match the candidate's priority
        // This ensures the opponent gets the same level of monitoring
        const candidateMonitoring = await this.prisma.entityMonitoring.findUnique({
            where: {
                entityType_entityId: {
                    entityType: EntityType.CANDIDATE,
                    entityId: candidateId
                }
            }
        });

        if (candidateMonitoring) {
            await this.prisma.entityMonitoring.upsert({
                where: {
                    entityType_entityId: {
                        entityType: EntityType.CANDIDATE,
                        entityId: opponentId
                    }
                },
                create: {
                    entityType: EntityType.CANDIDATE,
                    entityId: opponentId,
                    isActive: true,
                    priority: candidateMonitoring.priority, // Match candidate's priority
                    reason: 'SELECTED_OPPONENT',
                    triggeredByCandidateId: candidateId
                },
                update: {
                    priority: candidateMonitoring.priority, // Update to match
                    reason: 'SELECTED_OPPONENT',
                    isActive: true
                }
            });
        }

        this.logger.log(`✅ Updated opponent for candidate #${candidateId}`);
        return { success: true, opponentId };
    }

    /**
     * Update candidate's profile photo path
     */
    async updateProfilePhoto(candidateId: number, photoPath: string) {
        this.logger.log(`Updating profile photo for candidate #${candidateId}`);

        await this.prisma.candidateProfile.update({
            where: { candidateId },
            data: { profilePhotoPath: photoPath }
        });

        return { success: true, photoPath };
    }

    /**
     * Update candidate's profile text path
     */
    async updateProfileText(candidateId: number, textPath: string) {
        this.logger.log(`Updating profile text for candidate #${candidateId}`);

        await this.prisma.candidateProfile.update({
            where: { candidateId },
            data: { profileTextPath: textPath }
        });

        return { success: true, textPath };
    }

    /**
     * Update opponent's profile photo path
     */
    async updateOpponentProfilePhoto(candidateId: number, photoPath: string) {
        this.logger.log(`Updating opponent profile photo for candidate #${candidateId}`);

        await this.prisma.candidateProfile.update({
            where: { candidateId },
            data: { opponentProfilePhotoPath: photoPath }
        });

        return { success: true, photoPath };
    }

    /**
     * Update opponent's profile text path
     */
    async updateOpponentProfileText(candidateId: number, textPath: string) {
        this.logger.log(`Updating opponent profile text for candidate #${candidateId}`);

        await this.prisma.candidateProfile.update({
            where: { candidateId },
            data: { opponentProfileTextPath: textPath }
        });

        return { success: true, textPath };
    }

    /**
     * Get candidate's current settings
     */
    async getSettings(candidateId: number) {
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
            throw new BadRequestException(`Candidate profile #${candidateId} not found`);
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
}

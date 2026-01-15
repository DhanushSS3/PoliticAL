import { Controller, Get, Patch, Body, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { CandidateSettingsService } from './candidate-settings.service';

/**
 * CandidateSettingsController
 * Handles candidate profile settings endpoints
 */
@Controller('v1/settings')
export class CandidateSettingsController {
    constructor(private readonly settingsService: CandidateSettingsService) { }

    /**
     * Get candidate's current settings
     * GET /api/v1/settings?candidateId=123
     */
    @Get()
    async getSettings(@Query('candidateId', ParseIntPipe) candidateId: number) {
        return this.settingsService.getSettings(candidateId);
    }

    /**
     * Update selected opponent
     * PATCH /api/v1/settings/opponent
     * Body: { candidateId: number, opponentId: number }
     */
    @Patch('opponent')
    async updateOpponent(
        @Body('candidateId', ParseIntPipe) candidateId: number,
        @Body('opponentId', ParseIntPipe) opponentId: number
    ) {
        return this.settingsService.updateOpponent(candidateId, opponentId);
    }

    /**
     * Update candidate's profile photo
     * PATCH /api/v1/settings/profile-photo
     * Body: { candidateId: number, photoPath: string }
     */
    @Patch('profile-photo')
    async updateProfilePhoto(
        @Body('candidateId', ParseIntPipe) candidateId: number,
        @Body('photoPath') photoPath: string
    ) {
        return this.settingsService.updateProfilePhoto(candidateId, photoPath);
    }

    /**
     * Update candidate's profile text/bio
     * PATCH /api/v1/settings/profile-text
     * Body: { candidateId: number, textPath: string }
     */
    @Patch('profile-text')
    async updateProfileText(
        @Body('candidateId', ParseIntPipe) candidateId: number,
        @Body('textPath') textPath: string
    ) {
        return this.settingsService.updateProfileText(candidateId, textPath);
    }

    /**
     * Update opponent's profile photo
     * PATCH /api/v1/settings/opponent-photo
     * Body: { candidateId: number, photoPath: string }
     */
    @Patch('opponent-photo')
    async updateOpponentProfilePhoto(
        @Body('candidateId', ParseIntPipe) candidateId: number,
        @Body('photoPath') photoPath: string
    ) {
        return this.settingsService.updateOpponentProfilePhoto(candidateId, photoPath);
    }

    /**
     * Update opponent's profile text
     * PATCH /api/v1/settings/opponent-text
     * Body: { candidateId: number, textPath: string }
     */
    @Patch('opponent-text')
    async updateOpponentProfileText(
        @Body('candidateId', ParseIntPipe) candidateId: number,
        @Body('textPath') textPath: string
    ) {
        return this.settingsService.updateOpponentProfileText(candidateId, textPath);
    }
}

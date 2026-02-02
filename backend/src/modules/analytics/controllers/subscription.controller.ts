import {
    Controller,
    Post,
    Delete,
    Get,
    Param,
    Body,
    ParseIntPipe,
} from "@nestjs/common";
import { MonitoringManagerService } from "../services/monitoring-manager.service";
import { CreateCandidateDto } from "../dto/create-candidate.dto";
import { ActivateEntityDto } from "../dto/activate-entity.dto";

@Controller("admin/subscriptions")
export class SubscriptionController {
    constructor(private readonly monitoringManager: MonitoringManagerService) { }

    /**
     * POST /api/admin/subscriptions/activate
     * Activate monitoring for a candidate (simulate subscription)
     *
     * This triggers the cascade:
     * - Activates candidate
     * - Activates opponents in same constituency
     * - Activates party
     * - Activates constituency
     * - Seeds keywords for all
     *
     * @body { candidateId: number, userId?: number }
     */
    @Post("activate")
    async activateMonitoring(
        @Body() body: { candidateId: number; userId?: number },
    ) {
        const result = await this.monitoringManager.activateMonitoring(
            body.candidateId,
            body.userId,
        );

        return {
            success: true,
            message: `Monitoring activated for candidate #${body.candidateId}`,
            ...result,
        };
    }

    /**
     * DELETE /api/admin/subscriptions/:candidateId
     * Deactivate monitoring for a candidate (simulate unsubscribe)
     */
    @Delete(":candidateId")
    async deactivateMonitoring(
        @Param("candidateId", ParseIntPipe) candidateId: number,
    ) {
        await this.monitoringManager.deactivateMonitoring(candidateId);

        return {
            success: true,
            message: `Monitoring deactivated for candidate #${candidateId}`,
        };
    }

    /**
     * GET /api/admin/subscriptions/active
     * Get list of all actively monitored entities
     */
    @Get("active")
    async getActiveEntities() {
        const entities = await this.monitoringManager.getActiveEntities();

        return {
            total: entities.length,
            entities,
        };
    }

    /**
     * POST /api/admin/subscriptions/geounit/:id
     * Activate monitoring for a specific GeoUnit (Feature 4)
     */
    @Post("geounit/:id")
    async subscribeToGeoUnit(@Param("id", ParseIntPipe) id: number) {
        await this.monitoringManager.activateGeoMonitoring(id);
        return {
            message: `Monitoring activated for GeoUnit #${id}`,
        };
    }

    /**
     * POST /api/admin/subscriptions/entities
     * Activate monitoring for any entity type and seed keywords
     */
    @Post("entities")
    async activateEntity(@Body() dto: ActivateEntityDto) {
        const result = await this.monitoringManager.activateEntityWithKeywords({
            entityType: dto.entityType,
            entityId: dto.entityId,
            priority: dto.priority,
            reason: dto.reason,
            triggeredByCandidateId: dto.triggeredByCandidateId,
        });

        return {
            success: true,
            message: `Monitoring activated for ${dto.entityType} #${dto.entityId}`,
            ...result,
        };
    }

    /**
     * POST /api/admin/subscriptions/candidates
     * Create a new Candidate and Profile (Onboarding)
     */
    @Post("candidates")
    async createCandidate(@Body() dto: CreateCandidateDto) {
        const result = await this.monitoringManager.createCandidate(
            dto.fullName,
            dto.partyId,
            dto.constituencyId,
            dto.age,
            dto.gender
        );
        return {
            success: true,
            message: "Candidate created successfully",
            ...result
        };
    }
}

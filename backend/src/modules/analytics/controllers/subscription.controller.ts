import { Controller, Post, Delete, Get, Param, Body, ParseIntPipe } from '@nestjs/common';
import { MonitoringManagerService } from '../services/monitoring-manager.service';

@Controller('admin/subscriptions')
export class SubscriptionController {
    constructor(
        private readonly monitoringManager: MonitoringManagerService,
    ) { }

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
    @Post('activate')
    async activateMonitoring(
        @Body() body: { candidateId: number; userId?: number }
    ) {
        const result = await this.monitoringManager.activateMonitoring(
            body.candidateId,
            body.userId
        );

        return {
            success: true,
            message: `Monitoring activated for candidate #${body.candidateId}`,
            ...result
        };
    }

    /**
     * DELETE /api/admin/subscriptions/:candidateId
     * Deactivate monitoring for a candidate (simulate unsubscribe)
     */
    @Delete(':candidateId')
    async deactivateMonitoring(
        @Param('candidateId', ParseIntPipe) candidateId: number
    ) {
        await this.monitoringManager.deactivateMonitoring(candidateId);

        return {
            success: true,
            message: `Monitoring deactivated for candidate #${candidateId}`
        };
    }

    /**
     * GET /api/admin/subscriptions/active
     * Get list of all actively monitored entities
     */
    @Get('active')
    async getActiveEntities() {
        const entities = await this.monitoringManager.getActiveEntities();

        return {
            total: entities.length,
            entities
        };
    }
}

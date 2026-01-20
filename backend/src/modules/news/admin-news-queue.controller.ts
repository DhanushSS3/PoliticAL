import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { NewsQueueSchedulerService } from './services/news-queue-scheduler.service';

/**
 * Admin News Queue Controller
 * 
 * Provides endpoints for monitoring and managing news ingestion queues
 * Admin-only access
 */
@Controller('v1/admin/news-queue')
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminNewsQueueController {
    constructor(
        private readonly queueScheduler: NewsQueueSchedulerService,
    ) { }

    /**
     * Get queue statistics
     * GET /api/v1/admin/news-queue/stats
     */
    @Get('stats')
    async getQueueStats() {
        const stats = await this.queueScheduler.getQueueStats();
        return {
            success: true,
            data: stats,
        };
    }

    /**
     * Manually trigger Google News ingestion for a specific entity
     * POST /api/v1/admin/news-queue/trigger/google-news/:entityType/:entityId
     */
    @Post('trigger/google-news/:entityType/:entityId')
    async triggerGoogleNews(
        @Param('entityType') entityType: string,
        @Param('entityId') entityId: string,
    ) {
        await this.queueScheduler.triggerGoogleNewsNow(
            entityType,
            parseInt(entityId, 10),
        );

        return {
            success: true,
            message: `Google News ingestion triggered for ${entityType} #${entityId}`,
        };
    }

    /**
     * Manually trigger RSS feed ingestion
     * POST /api/v1/admin/news-queue/trigger/rss-feeds
     */
    @Post('trigger/rss-feeds')
    async triggerRssFeeds() {
        await this.queueScheduler.triggerRssFeedNow();

        return {
            success: true,
            message: 'RSS feed ingestion triggered',
        };
    }

    /**
     * Manually trigger scheduled Google News ingestion (all active entities)
     * POST /api/v1/admin/news-queue/trigger/google-news-all
     */
    @Post('trigger/google-news-all')
    async triggerGoogleNewsAll() {
        await this.queueScheduler.scheduleGoogleNewsIngestion();

        return {
            success: true,
            message: 'Google News ingestion scheduled for all active entities',
        };
    }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import {
    NEWS_QUEUES,
    GoogleNewsJobData,
    RssFeedJobData,
} from '../config/queue.config';

/**
 * News Ingestion Queue Scheduler
 * 
 * Implements the Worker Pattern for news ingestion:
 * - Cron jobs add tasks to queues
 * - Workers process tasks asynchronously
 * - User APIs read from database (no waiting)
 * 
 * This follows SOLID principles:
 * - Single Responsibility: Only schedules jobs, doesn't process them
 * - Open/Closed: Easy to add new job types
 * - Dependency Inversion: Depends on abstractions (Queue interface)
 */
@Injectable()
export class NewsQueueSchedulerService {
    private readonly logger = new Logger(NewsQueueSchedulerService.name);

    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue(NEWS_QUEUES.GOOGLE_NEWS)
        private readonly googleNewsQueue: Queue<GoogleNewsJobData>,
        @InjectQueue(NEWS_QUEUES.RSS_FEEDS)
        private readonly rssFeedQueue: Queue<RssFeedJobData>,
    ) { }

    /**
     * Schedule Google News ingestion every 30 minutes
     * Adds jobs to queue for all active entities
     */
    @Cron('*/30 * * * *') // Every 30 minutes
    async scheduleGoogleNewsIngestion() {
        this.logger.log('📅 Scheduling Google News ingestion jobs...');

        try {
            // Get active entities that need monitoring
            const activeEntities = await this.prisma.entityMonitoring.findMany({
                where: { isActive: true },
                select: {
                    entityType: true,
                    entityId: true,
                    priority: true,
                },
            });

            if (activeEntities.length === 0) {
                this.logger.warn('No active entities to monitor');
                return;
            }

            this.logger.log(`Adding ${activeEntities.length} jobs to Google News queue`);

            // Add jobs to queue
            const jobs = activeEntities.map((entity) => ({
                name: `google-news-${entity.entityType}-${entity.entityId}`,
                data: {
                    entityType: entity.entityType,
                    entityId: entity.entityId,
                    priority: entity.priority,
                } as GoogleNewsJobData,
                opts: {
                    priority: 10 - entity.priority, // BullMQ: lower number = higher priority
                    attempts: 3, // Retry up to 3 times
                    backoff: {
                        type: 'exponential' as const,
                        delay: 5000, // Start with 5s delay
                    },
                    removeOnComplete: 100, // Keep last 100 completed jobs
                    removeOnFail: 50, // Keep last 50 failed jobs
                },
            }));

            await this.googleNewsQueue.addBulk(jobs);

            this.logger.log(
                `✅ Added ${jobs.length} Google News jobs to queue`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to schedule Google News jobs: ${error.message}`,
            );
        }
    }

    /**
     * Schedule RSS feed ingestion every 2 hours
     * Fetches from Bangalore news sources
     */
    @Cron('0 */2 * * *') // Every 2 hours
    async scheduleRssFeedIngestion() {
        this.logger.log('📅 Scheduling RSS feed ingestion job...');

        try {
            await this.rssFeedQueue.add(
                'rss-feed-all-sources',
                {
                    priority: 8,
                } as RssFeedJobData,
                {
                    priority: 2, // High priority
                    attempts: 3,
                    backoff: {
                        type: 'exponential' as const,
                        delay: 10000,
                    },
                    removeOnComplete: 50,
                    removeOnFail: 25,
                },
            );

            this.logger.log('✅ Added RSS feed job to queue');
        } catch (error) {
            this.logger.error(`Failed to schedule RSS feed job: ${error.message}`);
        }
    }

    /**
     * Manual trigger for Google News ingestion (for testing/admin)
     */
    async triggerGoogleNewsNow(
        entityType: string,
        entityId: number,
    ): Promise<void> {
        this.logger.log(
            `Manually triggering Google News for ${entityType} #${entityId}`,
        );

        await this.googleNewsQueue.add(
            `manual-google-news-${entityType}-${entityId}`,
            {
                entityType,
                entityId,
                priority: 10,
            } as GoogleNewsJobData,
            {
                priority: 1, // Highest priority
                attempts: 1,
            },
        );
    }

    /**
     * Manual trigger for RSS feed ingestion (for testing/admin)
     */
    async triggerRssFeedNow(): Promise<void> {
        this.logger.log('Manually triggering RSS feed ingestion');

        await this.rssFeedQueue.add(
            'manual-rss-feed',
            {
                priority: 10,
            } as RssFeedJobData,
            {
                priority: 1,
                attempts: 1,
            },
        );
    }

    /**
     * Get queue statistics
     */
    async getQueueStats() {
        const googleNewsStats = {
            waiting: await this.googleNewsQueue.getWaitingCount(),
            active: await this.googleNewsQueue.getActiveCount(),
            completed: await this.googleNewsQueue.getCompletedCount(),
            failed: await this.googleNewsQueue.getFailedCount(),
        };

        const rssFeedStats = {
            waiting: await this.rssFeedQueue.getWaitingCount(),
            active: await this.rssFeedQueue.getActiveCount(),
            completed: await this.rssFeedQueue.getCompletedCount(),
            failed: await this.rssFeedQueue.getFailedCount(),
        };

        return {
            googleNews: googleNewsStats,
            rssFeed: rssFeedStats,
        };
    }
}

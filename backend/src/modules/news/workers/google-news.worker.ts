import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NEWS_QUEUES, GoogleNewsJobData } from '../config/queue.config';
import { NewsIngestionService } from '../services/news-ingestion.service';
import { EntityType } from '@prisma/client';

/**
 * Google News Worker Processor
 * 
 * Handles asynchronous Google News ingestion jobs
 * This runs in the background, separate from user requests
 */
@Processor(NEWS_QUEUES.GOOGLE_NEWS, {
    concurrency: 3, // Process 3 jobs concurrently
    limiter: {
        max: 10, // Max 10 jobs
        duration: 60000, // Per minute
    },
})
export class GoogleNewsWorker extends WorkerHost {
    private readonly logger = new Logger(GoogleNewsWorker.name);

    constructor(private readonly newsIngestion: NewsIngestionService) {
        super();
    }

    async process(job: Job<GoogleNewsJobData>): Promise<void> {
        const { entityType, entityId, priority } = job.data;

        this.logger.log(
            `Processing Google News job for ${entityType} #${entityId} (priority: ${priority})`,
        );

        try {
            await this.newsIngestion.fetchNewsForEntity(
                entityType as EntityType,
                entityId,
            );

            this.logger.log(
                `✅ Completed Google News job for ${entityType} #${entityId}`,
            );
        } catch (error) {
            this.logger.error(
                `❌ Failed Google News job for ${entityType} #${entityId}: ${error.message}`,
            );
            throw error; // Re-throw to trigger retry logic
        }
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job<GoogleNewsJobData>) {
        this.logger.debug(`Job ${job.id} completed successfully`);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job<GoogleNewsJobData>, error: Error) {
        this.logger.error(
            `Job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
        );
    }

    @OnWorkerEvent('active')
    onActive(job: Job<GoogleNewsJobData>) {
        this.logger.debug(`Job ${job.id} is now active`);
    }
}

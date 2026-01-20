import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NEWS_QUEUES, RssFeedJobData } from '../config/queue.config';
import { RssFeedIngestionService } from '../services/rss-feed-ingestion.service';

/**
 * RSS Feed Worker Processor
 * 
 * Handles asynchronous RSS feed ingestion jobs
 * Fetches from Bangalore news sources (The Hindu, TOI, etc.)
 */
@Processor(NEWS_QUEUES.RSS_FEEDS, {
    concurrency: 2, // Process 2 sources concurrently
    limiter: {
        max: 5, // Max 5 jobs
        duration: 60000, // Per minute
    },
})
export class RssFeedWorker extends WorkerHost {
    private readonly logger = new Logger(RssFeedWorker.name);

    constructor(private readonly rssFeedIngestion: RssFeedIngestionService) {
        super();
    }

    async process(job: Job<RssFeedJobData>): Promise<void> {
        const { sourceName, priority } = job.data;

        this.logger.log(
            `Processing RSS feed job${sourceName ? ` for ${sourceName}` : ' (all sources)'} (priority: ${priority})`,
        );

        try {
            if (sourceName) {
                // Fetch from specific source (not implemented yet - would need to find source by name)
                this.logger.warn('Single source fetching not yet implemented, fetching all');
                await this.rssFeedIngestion.fetchFromAllSources();
            } else {
                await this.rssFeedIngestion.fetchFromAllSources();
            }

            this.logger.log(`✅ Completed RSS feed job`);
        } catch (error) {
            this.logger.error(`❌ Failed RSS feed job: ${error.message}`);
            throw error;
        }
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job<RssFeedJobData>) {
        this.logger.debug(`Job ${job.id} completed successfully`);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job<RssFeedJobData>, error: Error) {
        this.logger.error(
            `Job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
        );
    }

    @OnWorkerEvent('active')
    onActive(job: Job<RssFeedJobData>) {
        this.logger.debug(`Job ${job.id} is now active`);
    }
}

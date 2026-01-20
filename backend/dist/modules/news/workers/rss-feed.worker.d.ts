import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RssFeedJobData } from '../config/queue.config';
import { RssFeedIngestionService } from '../services/rss-feed-ingestion.service';
export declare class RssFeedWorker extends WorkerHost {
    private readonly rssFeedIngestion;
    private readonly logger;
    constructor(rssFeedIngestion: RssFeedIngestionService);
    process(job: Job<RssFeedJobData>): Promise<void>;
    onCompleted(job: Job<RssFeedJobData>): void;
    onFailed(job: Job<RssFeedJobData>, error: Error): void;
    onActive(job: Job<RssFeedJobData>): void;
}

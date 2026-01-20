import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { GoogleNewsJobData } from '../config/queue.config';
import { NewsIngestionService } from '../services/news-ingestion.service';
export declare class GoogleNewsWorker extends WorkerHost {
    private readonly newsIngestion;
    private readonly logger;
    constructor(newsIngestion: NewsIngestionService);
    process(job: Job<GoogleNewsJobData>): Promise<void>;
    onCompleted(job: Job<GoogleNewsJobData>): void;
    onFailed(job: Job<GoogleNewsJobData>, error: Error): void;
    onActive(job: Job<GoogleNewsJobData>): void;
}

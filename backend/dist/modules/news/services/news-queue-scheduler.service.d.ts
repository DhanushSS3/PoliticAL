import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { GoogleNewsJobData, RssFeedJobData } from '../config/queue.config';
export declare class NewsQueueSchedulerService {
    private readonly prisma;
    private readonly googleNewsQueue;
    private readonly rssFeedQueue;
    private readonly logger;
    constructor(prisma: PrismaService, googleNewsQueue: Queue<GoogleNewsJobData>, rssFeedQueue: Queue<RssFeedJobData>);
    scheduleGoogleNewsIngestion(): Promise<void>;
    scheduleRssFeedIngestion(): Promise<void>;
    triggerGoogleNewsNow(entityType: string, entityId: number): Promise<void>;
    triggerRssFeedNow(): Promise<void>;
    getQueueStats(): Promise<{
        googleNews: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
        };
        rssFeed: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
        };
    }>;
}

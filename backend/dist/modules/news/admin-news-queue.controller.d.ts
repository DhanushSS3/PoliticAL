import { NewsQueueSchedulerService } from './services/news-queue-scheduler.service';
export declare class AdminNewsQueueController {
    private readonly queueScheduler;
    constructor(queueScheduler: NewsQueueSchedulerService);
    getQueueStats(): Promise<{
        success: boolean;
        data: {
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
        };
    }>;
    triggerGoogleNews(entityType: string, entityId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    triggerRssFeeds(): Promise<{
        success: boolean;
        message: string;
    }>;
    triggerGoogleNewsAll(): Promise<{
        success: boolean;
        message: string;
    }>;
}

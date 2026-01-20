/**
 * News Ingestion Queue Names and Job Types
 * 
 * Defines the queue structure for asynchronous news processing
 */

export const NEWS_QUEUES = {
    GOOGLE_NEWS: 'news-google-ingestion',
    RSS_FEEDS: 'news-rss-ingestion',
    ENTITY_LINKING: 'news-entity-linking',
} as const;

export interface GoogleNewsJobData {
    entityType: string;
    entityId: number;
    priority: number;
}

export interface RssFeedJobData {
    sourceName?: string; // If specified, only fetch from this source
    priority: number;
}

export interface EntityLinkingJobData {
    articleId: number;
    fullText: string;
}

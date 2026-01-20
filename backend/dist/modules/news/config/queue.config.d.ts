export declare const NEWS_QUEUES: {
    readonly GOOGLE_NEWS: "news-google-ingestion";
    readonly RSS_FEEDS: "news-rss-ingestion";
    readonly ENTITY_LINKING: "news-entity-linking";
};
export interface GoogleNewsJobData {
    entityType: string;
    entityId: number;
    priority: number;
}
export interface RssFeedJobData {
    sourceName?: string;
    priority: number;
}
export interface EntityLinkingJobData {
    articleId: number;
    fullText: string;
}

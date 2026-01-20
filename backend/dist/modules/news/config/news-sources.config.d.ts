export interface NewsSource {
    name: string;
    url: string;
    description: string;
    priority: number;
    language?: string;
    category?: string;
}
export declare const BANGALORE_NEWS_SOURCES: NewsSource[];
export declare const EVENT_KEYWORDS: string[];
export declare const GOOGLE_NEWS_TIME_FILTERS: {
    readonly PAST_HOUR: "qdr:h";
    readonly PAST_DAY: "qdr:d";
    readonly PAST_WEEK: "qdr:w";
    readonly PAST_MONTH: "qdr:m";
    readonly PAST_YEAR: "qdr:y";
};
export type GoogleNewsTimeFilter = typeof GOOGLE_NEWS_TIME_FILTERS[keyof typeof GOOGLE_NEWS_TIME_FILTERS];

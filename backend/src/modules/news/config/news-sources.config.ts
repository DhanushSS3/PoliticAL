/**
 * News Source Configuration
 * 
 * Defines RSS feeds for Bangalore-specific news sources
 * These sources provide high-quality local news, civic issues, and regional updates
 */

export interface NewsSource {
    name: string;
    url: string;
    description: string;
    priority: number; // 1-10, higher = more important
    language?: string;
    category?: string;
}

/**
 * Bangalore-specific RSS News Sources
 */
export const BANGALORE_NEWS_SOURCES: NewsSource[] = [
    {
        name: 'The Hindu - Bangalore',
        url: 'https://www.thehindu.com/news/cities/bangalore/feeder/default.rss',
        description: 'High-quality city updates',
        priority: 9,
        language: 'en',
        category: 'city_news',
    },
    {
        name: 'Times of India - Bangalore',
        url: 'https://timesofindia.indiatimes.com/rssfeeds/-2128833038.cms',
        description: 'Crime & Local Incidents',
        priority: 8,
        language: 'en',
        category: 'crime_local',
    },
    {
        name: 'New Indian Express - Bangalore',
        url: 'https://www.newindianexpress.com/Cities/Bengaluru/rssfeed/?id=182&getXmlFeed=true',
        description: 'Civic issues & BBMP',
        priority: 8,
        language: 'en',
        category: 'civic_issues',
    },
    {
        name: 'OneIndia Kannada - Bangalore',
        url: 'https://kannada.oneindia.com/rss/feeds/kannada-bengaluru-fb.xml',
        description: 'Best for Kannada local news',
        priority: 7,
        language: 'kn',
        category: 'regional',
    },
    {
        name: 'Citizen Matters - Bangalore',
        url: 'https://citizenmatters.in/bengaluru/feed/',
        description: 'In-depth civic and community journalism',
        priority: 8,
        language: 'en',
        category: 'civic_journalism',
    },
];

/**
 * Event-based keyword modifiers for better search relevance
 * These are appended to entity names to find recent, actionable news
 */
export const EVENT_KEYWORDS = [
    'protest',
    'announced',
    'controversy',
    'statement',
    'rally',
    'speech',
    'visit',
    'meeting',
    'accused',
    'responded',
    'criticized',
    'defended',
    'launched',
    'inaugurated',
];

/**
 * Time-based search parameters for Google News RSS
 * Forces recency over relevance
 */
export const GOOGLE_NEWS_TIME_FILTERS = {
    PAST_HOUR: 'qdr:h',
    PAST_DAY: 'qdr:d',
    PAST_WEEK: 'qdr:w',
    PAST_MONTH: 'qdr:m',
    PAST_YEAR: 'qdr:y',
} as const;

export type GoogleNewsTimeFilter = typeof GOOGLE_NEWS_TIME_FILTERS[keyof typeof GOOGLE_NEWS_TIME_FILTERS];

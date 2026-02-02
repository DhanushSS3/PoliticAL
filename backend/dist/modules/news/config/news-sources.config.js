"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOOGLE_NEWS_TIME_FILTERS = exports.EVENT_KEYWORDS = exports.BANGALORE_NEWS_SOURCES = void 0;
exports.BANGALORE_NEWS_SOURCES = [
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
        url: 'https://www.newindianexpress.com/cities/bengaluru/rssfeed/',
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
        url: 'https://citizenmatters.in/feed/',
        description: 'In-depth civic and community journalism',
        priority: 8,
        language: 'en',
        category: 'civic_journalism',
    },
];
exports.EVENT_KEYWORDS = [
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
exports.GOOGLE_NEWS_TIME_FILTERS = {
    PAST_HOUR: 'qdr:h',
    PAST_DAY: 'qdr:d',
    PAST_WEEK: 'qdr:w',
    PAST_MONTH: 'qdr:m',
    PAST_YEAR: 'qdr:y',
};
//# sourceMappingURL=news-sources.config.js.map
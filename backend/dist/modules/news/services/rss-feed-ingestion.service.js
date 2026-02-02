"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RssFeedIngestionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RssFeedIngestionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const prisma_service_1 = require("../../../prisma/prisma.service");
const sentiment_analysis_service_1 = require("./sentiment-analysis.service");
const news_sources_config_1 = require("../config/news-sources.config");
const client_1 = require("@prisma/client");
const Parser = require('rss-parser');
let RssFeedIngestionService = RssFeedIngestionService_1 = class RssFeedIngestionService {
    constructor(prisma, sentimentService, configService, httpService) {
        this.prisma = prisma;
        this.sentimentService = sentimentService;
        this.configService = configService;
        this.httpService = httpService;
        this.logger = new common_1.Logger(RssFeedIngestionService_1.name);
        this.parser = new Parser();
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0'
        ];
        this.maxArticleAgeHours = this.configService.get('NEWS_ARTICLE_MAX_AGE_HOURS', 48);
    }
    async fetchFromAllSources() {
        this.logger.log(`Starting RSS feed ingestion from ${news_sources_config_1.BANGALORE_NEWS_SOURCES.length} sources...`);
        for (const source of news_sources_config_1.BANGALORE_NEWS_SOURCES) {
            await this.fetchFromSource(source);
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        this.logger.log('✅ RSS feed ingestion completed');
    }
    async fetchFromSource(source) {
        var _a;
        try {
            this.logger.debug(`Fetching from ${source.name}...`);
            const randomUserAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
            const response = await (0, rxjs_1.lastValueFrom)(this.httpService.get(source.url, {
                headers: {
                    'User-Agent': randomUserAgent,
                    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                },
                timeout: 10000,
            }));
            const feed = await this.parser.parseString(response.data);
            let processedCount = 0;
            let skippedOldCount = 0;
            let skippedDuplicateCount = 0;
            for (const item of feed.items) {
                const result = await this.processRssItem(item, source);
                if (result === 'processed')
                    processedCount++;
                else if (result === 'too_old')
                    skippedOldCount++;
                else if (result === 'duplicate')
                    skippedDuplicateCount++;
            }
            this.logger.log(`${source.name}: Processed ${processedCount}, Skipped (old: ${skippedOldCount}, duplicate: ${skippedDuplicateCount})`);
        }
        catch (error) {
            this.logger.error(`Failed to fetch from ${source.name}: ${error.message} (Status: ${((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 'Unknown'})`);
        }
    }
    async processRssItem(item, source) {
        try {
            const title = item.title;
            const link = item.link;
            const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
            const summary = item.contentSnippet || item.content || item.description || title;
            const articleAgeHours = this.getArticleAgeInHours(pubDate);
            if (articleAgeHours > this.maxArticleAgeHours) {
                this.logger.debug(`Skipping old article (${articleAgeHours.toFixed(1)}h old): "${title}"`);
                return 'too_old';
            }
            const existing = await this.prisma.newsArticle.findFirst({
                where: { sourceUrl: link },
            });
            if (existing) {
                return 'duplicate';
            }
            const article = await this.prisma.newsArticle.create({
                data: {
                    title,
                    summary,
                    sourceName: source.name,
                    sourceUrl: link,
                    publishedAt: pubDate,
                    ingestType: client_1.NewsIngestType.API,
                    status: client_1.ModerationStatus.APPROVED,
                },
            });
            this.logger.log(`Ingested: "${title}" (${articleAgeHours.toFixed(1)}h old)`);
            const fullText = `${title}. ${summary}`;
            this.sentimentService
                .analyzeAndStoreSentiment(article.id, fullText)
                .catch((err) => this.logger.error(`Sentiment analysis failed: ${err.message}`));
            await this.linkArticleToEntities(article.id, fullText);
            return 'processed';
        }
        catch (error) {
            this.logger.warn(`Failed to process RSS item "${item.title}": ${error.message}`);
            return 'duplicate';
        }
    }
    getArticleAgeInHours(pubDate) {
        const now = new Date();
        const diffMs = now.getTime() - pubDate.getTime();
        return diffMs / (1000 * 60 * 60);
    }
    async linkArticleToEntities(articleId, fullText) {
        try {
            const candidates = await this.prisma.candidate.findMany({
                select: { id: true, fullName: true },
            });
            const sortedCandidates = candidates.sort((a, b) => b.fullName.length - a.fullName.length);
            const linkedIds = new Set();
            const textToSearch = fullText;
            for (const candidate of sortedCandidates) {
                const name = candidate.fullName;
                const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
                if (regex.test(textToSearch)) {
                    const existingLink = await this.prisma.newsEntityMention.findFirst({
                        where: {
                            articleId,
                            entityType: client_1.EntityType.CANDIDATE,
                            entityId: candidate.id,
                        },
                    });
                    if (!existingLink) {
                        await this.prisma.newsEntityMention.create({
                            data: {
                                articleId,
                                entityType: client_1.EntityType.CANDIDATE,
                                entityId: candidate.id,
                            },
                        });
                        this.logger.debug(`Linked article #${articleId} to candidate: ${candidate.fullName}`);
                    }
                    linkedIds.add(candidate.id);
                }
            }
        }
        catch (error) {
            this.logger.error(`Failed to link article #${articleId} to entities: ${error.message}`);
        }
    }
};
exports.RssFeedIngestionService = RssFeedIngestionService;
exports.RssFeedIngestionService = RssFeedIngestionService = RssFeedIngestionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sentiment_analysis_service_1.SentimentAnalysisService,
        config_1.ConfigService,
        axios_1.HttpService])
], RssFeedIngestionService);
//# sourceMappingURL=rss-feed-ingestion.service.js.map
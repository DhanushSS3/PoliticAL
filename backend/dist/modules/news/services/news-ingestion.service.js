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
var NewsIngestionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsIngestionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const keyword_manager_service_1 = require("./keyword-manager.service");
const sentiment_analysis_service_1 = require("./sentiment-analysis.service");
const client_1 = require("@prisma/client");
const Parser = require('rss-parser');
let NewsIngestionService = NewsIngestionService_1 = class NewsIngestionService {
    constructor(prisma, keywordManager, sentimentService) {
        this.prisma = prisma;
        this.keywordManager = keywordManager;
        this.sentimentService = sentimentService;
        this.logger = new common_1.Logger(NewsIngestionService_1.name);
        this.parser = new Parser();
        this.GOOGLE_NEWS_BASE_URL = 'https://news.google.com/rss/search?q=';
    }
    async fetchAllNews() {
        this.logger.log('Starting Google News ingestion job...');
        const jobStart = new Date();
        const candidates = await this.prisma.candidate.findMany({ select: { id: true } });
        for (const c of candidates) {
            await this.fetchNewsForEntity(client_1.EntityType.CANDIDATE, c.id);
        }
        const geoUnits = await this.prisma.geoUnit.findMany({
            where: { level: 'STATE' },
            select: { id: true }
        });
        for (const g of geoUnits) {
            await this.fetchNewsForEntity(client_1.EntityType.GEO_UNIT, g.id);
        }
        const parties = await this.prisma.party.findMany({ select: { id: true } });
        for (const p of parties) {
            await this.fetchNewsForEntity(client_1.EntityType.PARTY, p.id);
        }
        this.logger.log(`Ingestion job completed. Started at ${jobStart.toISOString()}`);
    }
    async fetchNewsForEntity(entityType, entityId) {
        try {
            const query = await this.keywordManager.buildSearchQuery(entityType, entityId);
            if (!query) {
                return;
            }
            this.logger.debug(`Fetching news for ${entityType} #${entityId} using query: ${query}`);
            const encodedQuery = encodeURIComponent(query + ' when:1d');
            const feedUrl = `${this.GOOGLE_NEWS_BASE_URL}${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en`;
            const feed = await this.parser.parseURL(feedUrl);
            for (const item of feed.items) {
                await this.processFeedItem(item, entityType, entityId);
            }
        }
        catch (error) {
            this.logger.error(`Failed to fetch news for ${entityType} #${entityId}: ${error.message}`);
        }
    }
    async processFeedItem(item, entityType, entityId) {
        try {
            const title = item.title;
            const link = item.link;
            const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
            const sourceName = item.source || 'Google News';
            const summary = item.contentSnippet || item.content || item.title;
            const existing = await this.prisma.newsArticle.findFirst({
                where: { sourceUrl: link },
            });
            if (existing) {
                const existingLink = await this.prisma.newsEntityMention.findFirst({
                    where: {
                        articleId: existing.id,
                        entityType,
                        entityId,
                    },
                });
                if (!existingLink) {
                    await this.prisma.newsEntityMention.create({
                        data: {
                            articleId: existing.id,
                            entityType,
                            entityId,
                        },
                    });
                }
                return;
            }
            const article = await this.prisma.newsArticle.create({
                data: {
                    title,
                    summary,
                    sourceName,
                    sourceUrl: link,
                    publishedAt: pubDate,
                    ingestType: client_1.NewsIngestType.API,
                    status: client_1.ModerationStatus.APPROVED,
                },
            });
            await this.prisma.newsEntityMention.create({
                data: {
                    articleId: article.id,
                    entityType,
                    entityId,
                },
            });
            this.logger.log(`Ingested article: "${title}" for ${entityType} #${entityId}`);
            const contextGeoId = entityType === client_1.EntityType.GEO_UNIT ? entityId : undefined;
            const fullText = `${title}. ${summary}`;
            this.sentimentService.analyzeAndStoreSentiment(article.id, fullText, contextGeoId)
                .catch(err => this.logger.error(`Sentiment trigger failed: ${err.message}`));
        }
        catch (error) {
            this.logger.warn(`Failed to save article "${item.title}": ${error.message}`);
        }
    }
};
exports.NewsIngestionService = NewsIngestionService;
exports.NewsIngestionService = NewsIngestionService = NewsIngestionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        keyword_manager_service_1.KeywordManagerService,
        sentiment_analysis_service_1.SentimentAnalysisService])
], NewsIngestionService);
//# sourceMappingURL=news-ingestion.service.js.map
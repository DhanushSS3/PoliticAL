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
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../../prisma/prisma.service");
const keyword_manager_service_1 = require("./keyword-manager.service");
const sentiment_analysis_service_1 = require("./sentiment-analysis.service");
const client_1 = require("@prisma/client");
const news_sources_config_1 = require("../config/news-sources.config");
const Parser = require("rss-parser");
let NewsIngestionService = NewsIngestionService_1 = class NewsIngestionService {
    constructor(prisma, keywordManager, sentimentService, configService) {
        this.prisma = prisma;
        this.keywordManager = keywordManager;
        this.sentimentService = sentimentService;
        this.configService = configService;
        this.logger = new common_1.Logger(NewsIngestionService_1.name);
        this.parser = new Parser();
        this.GOOGLE_NEWS_BASE_URL = "https://news.google.com/rss/search?q=";
        this.maxArticleAgeHours = this.configService.get('NEWS_ARTICLE_MAX_AGE_HOURS', 48);
        const filterKey = this.configService.get('GOOGLE_NEWS_TIME_FILTER', 'd');
        this.timeFilter = news_sources_config_1.GOOGLE_NEWS_TIME_FILTERS[`PAST_${filterKey.toUpperCase()}`] || news_sources_config_1.GOOGLE_NEWS_TIME_FILTERS.PAST_DAY;
    }
    async fetchAllNews() {
        this.logger.log("Starting Google News ingestion job (ACTIVE entities only)...");
        const jobStart = new Date();
        const activeEntities = await this.prisma.entityMonitoring.findMany({
            where: { isActive: true },
            select: {
                entityType: true,
                entityId: true,
                reason: true,
            },
        });
        this.logger.log(`Found ${activeEntities.length} active entities to monitor`);
        if (activeEntities.length === 0) {
            this.logger.warn("⚠️ No active entities to monitor. Have any candidates subscribed?");
            return;
        }
        const byType = {
            CANDIDATE: activeEntities.filter((e) => e.entityType === "CANDIDATE")
                .length,
            PARTY: activeEntities.filter((e) => e.entityType === "PARTY").length,
            GEO_UNIT: activeEntities.filter((e) => e.entityType === "GEO_UNIT")
                .length,
        };
        this.logger.log(`Active breakdown: ${byType.CANDIDATE} candidates, ${byType.PARTY} parties, ${byType.GEO_UNIT} geo units`);
        for (const entity of activeEntities) {
            await this.fetchNewsForEntity(entity.entityType, entity.entityId);
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        this.logger.log(`✅ Ingestion job completed. Started at ${jobStart.toISOString()}, active entities: ${activeEntities.length}`);
    }
    async fetchNewsForEntity(entityType, entityId, retryCount = 0) {
        try {
            const query = await this.keywordManager.buildSearchQuery(entityType, entityId);
            if (!query) {
                return;
            }
            this.logger.debug(`Fetching news for ${entityType} #${entityId} using query: ${query}`);
            const encodedQuery = encodeURIComponent(query);
            const feedUrl = `${this.GOOGLE_NEWS_BASE_URL}${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en&tbs=${this.timeFilter}`;
            this.logger.debug(`Feed URL: ${feedUrl}`);
            const feed = await this.parser.parseURL(feedUrl);
            for (const item of feed.items) {
                await this.processFeedItem(item, entityType, entityId);
            }
        }
        catch (error) {
            if (retryCount < 2 && error.message.includes("503")) {
                this.logger.warn(`Rate limited (503) for ${entityType} #${entityId}. Retrying in 5s...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                return this.fetchNewsForEntity(entityType, entityId, retryCount + 1);
            }
            this.logger.error(`Failed to fetch news for ${entityType} #${entityId}: ${error.message}`);
        }
    }
    async processFeedItem(item, entityType, entityId) {
        try {
            const title = item.title;
            const link = item.link;
            const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
            const sourceName = item.source || "Google News";
            const summary = item.contentSnippet || item.content || item.title;
            const articleAgeHours = this.getArticleAgeInHours(pubDate);
            if (articleAgeHours > this.maxArticleAgeHours) {
                this.logger.debug(`Skipping old article (${articleAgeHours.toFixed(1)}h old): "${title}"`);
                return;
            }
            const entityName = await this.getEntityName(entityType, entityId);
            if (entityName) {
                const escapedName = entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
                const fullTextForCheck = `${title} ${summary}`;
                if (!regex.test(fullTextForCheck)) {
                    this.logger.debug(`Strict check failed: "${entityName}" not found in article "${title}". Skipping.`);
                    return;
                }
            }
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
            this.sentimentService
                .analyzeAndStoreSentiment(article.id, fullText, contextGeoId)
                .catch((err) => this.logger.error(`Sentiment trigger failed: ${err.message}`));
        }
        catch (error) {
            this.logger.warn(`Failed to save article "${item.title}": ${error.message}`);
        }
    }
    getArticleAgeInHours(pubDate) {
        const now = new Date();
        const diffMs = now.getTime() - pubDate.getTime();
        return diffMs / (1000 * 60 * 60);
    }
    async buildEnhancedQuery(entityType, entityId) {
        const baseQuery = await this.keywordManager.buildSearchQuery(entityType, entityId);
        if (!baseQuery) {
            return [];
        }
        if (entityType === client_1.EntityType.CANDIDATE) {
            const queries = [];
            queries.push(baseQuery);
            const topEventKeywords = news_sources_config_1.EVENT_KEYWORDS.slice(0, 3);
            for (const keyword of topEventKeywords) {
                queries.push(`${baseQuery} "${keyword}"`);
            }
            return queries;
        }
        return [baseQuery];
    }
    async getEntityName(type, id) {
        if (type === client_1.EntityType.CANDIDATE) {
            const c = await this.prisma.candidate.findUnique({ where: { id }, select: { fullName: true } });
            return (c === null || c === void 0 ? void 0 : c.fullName) || null;
        }
        else if (type === client_1.EntityType.PARTY) {
            const p = await this.prisma.party.findUnique({ where: { id }, select: { name: true } });
            return (p === null || p === void 0 ? void 0 : p.name) || null;
        }
        else if (type === client_1.EntityType.GEO_UNIT) {
            const g = await this.prisma.geoUnit.findUnique({ where: { id }, select: { name: true } });
            return (g === null || g === void 0 ? void 0 : g.name) || null;
        }
        return null;
    }
};
exports.NewsIngestionService = NewsIngestionService;
exports.NewsIngestionService = NewsIngestionService = NewsIngestionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        keyword_manager_service_1.KeywordManagerService,
        sentiment_analysis_service_1.SentimentAnalysisService,
        config_1.ConfigService])
], NewsIngestionService);
//# sourceMappingURL=news-ingestion.service.js.map
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../prisma/prisma.service";
import { KeywordManagerService } from "./keyword-manager.service";
import { SentimentAnalysisService } from "./sentiment-analysis.service";
import { EntityType, NewsIngestType, ModerationStatus } from "@prisma/client";
import { EVENT_KEYWORDS, GOOGLE_NEWS_TIME_FILTERS } from "../config/news-sources.config";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Parser = require("rss-parser");

@Injectable()
export class NewsIngestionService {
  private readonly logger = new Logger(NewsIngestionService.name);
  private readonly parser = new Parser();
  private readonly GOOGLE_NEWS_BASE_URL =
    "https://news.google.com/rss/search?q=";
  private readonly maxArticleAgeHours: number;
  private readonly timeFilter: string;

  constructor(
    private prisma: PrismaService,
    private keywordManager: KeywordManagerService,
    private sentimentService: SentimentAnalysisService,
    private configService: ConfigService,
  ) {
    this.maxArticleAgeHours = this.configService.get<number>(
      'NEWS_ARTICLE_MAX_AGE_HOURS',
      48,
    );
    const filterKey = this.configService.get<string>(
      'GOOGLE_NEWS_TIME_FILTER',
      'd',
    );
    this.timeFilter = GOOGLE_NEWS_TIME_FILTERS[`PAST_${filterKey.toUpperCase()}`] || GOOGLE_NEWS_TIME_FILTERS.PAST_DAY;
  }

  /**
   * Main job entry point: Fetch news for ACTIVELY MONITORED entities only
   * This uses EntityMonitoring table to determine which entities to track.
   *
   * 🔥 This is the KEY performance optimization:
   * Instead of fetching for all 8,040+ candidates, we only fetch for:
   * - Subscribed candidates
   * - Their opponents
   * - Their parties
   * - Their constituencies
   *
   * This reduces compute by 80-90%!
   */
  async fetchAllNews() {
    this.logger.log(
      "Starting Google News ingestion job (ACTIVE entities only)...",
    );
    const jobStart = new Date();

    //  Get ONLY actively monitored entities
    const activeEntities = await this.prisma.entityMonitoring.findMany({
      where: { isActive: true },
      select: {
        entityType: true,
        entityId: true,
        reason: true,
      },
    });

    this.logger.log(
      `Found ${activeEntities.length} active entities to monitor`,
    );

    if (activeEntities.length === 0) {
      this.logger.warn(
        "⚠️ No active entities to monitor. Have any candidates subscribed?",
      );
      return;
    }

    // Group by entity type for cleaner logging
    const byType = {
      CANDIDATE: activeEntities.filter((e) => e.entityType === "CANDIDATE")
        .length,
      PARTY: activeEntities.filter((e) => e.entityType === "PARTY").length,
      GEO_UNIT: activeEntities.filter((e) => e.entityType === "GEO_UNIT")
        .length,
    };

    this.logger.log(
      `Active breakdown: ${byType.CANDIDATE} candidates, ${byType.PARTY} parties, ${byType.GEO_UNIT} geo units`,
    );

    // Fetch news for each active entity
    for (const entity of activeEntities) {
      await this.fetchNewsForEntity(entity.entityType, entity.entityId);
      // Wait 1-2 seconds between entities to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    this.logger.log(
      `✅ Ingestion job completed. Started at ${jobStart.toISOString()}, active entities: ${activeEntities.length}`,
    );
  }

  /**
   * Fetch news for a specific entity using its keywords
   */
  async fetchNewsForEntity(entityType: EntityType, entityId: number, retryCount = 0) {
    try {
      // 1. Build Query
      const query = await this.keywordManager.buildSearchQuery(
        entityType,
        entityId,
      );
      if (!query) {
        return;
      }

      this.logger.debug(
        `Fetching news for ${entityType} #${entityId} using query: ${query}`,
      );

      // 2. Fetch RSS Feed with TIME-BASED FILTERING (tbs parameter)
      // This forces Google to prioritize recency over relevance
      const encodedQuery = encodeURIComponent(query);
      const feedUrl = `${this.GOOGLE_NEWS_BASE_URL}${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en&tbs=${this.timeFilter}`;

      this.logger.debug(`Feed URL: ${feedUrl}`);
      const feed = await this.parser.parseURL(feedUrl);

      // 3. Process Items
      for (const item of feed.items) {
        await this.processFeedItem(item, entityType, entityId);
      }
    } catch (error) {
      // Retry for 503 or transient errors
      if (retryCount < 2 && error.message.includes("503")) {
        this.logger.warn(`Rate limited (503) for ${entityType} #${entityId}. Retrying in 5s...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.fetchNewsForEntity(entityType, entityId, retryCount + 1);
      }

      this.logger.error(
        `Failed to fetch news for ${entityType} #${entityId}: ${error.message}`,
      );
    }
  }

  /**
   * Normalize and save a single news item
   */
  private async processFeedItem(
    item: any,
    entityType: EntityType,
    entityId: number,
  ) {
    try {
      const title = item.title;
      const link = item.link;
      const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
      const sourceName = item.source || "Google News";
      const summary = item.contentSnippet || item.content || item.title;

      // ✅ CRITICAL: Post-processing filter - Check article age
      const articleAgeHours = this.getArticleAgeInHours(pubDate);
      if (articleAgeHours > this.maxArticleAgeHours) {
        this.logger.debug(
          `Skipping old article (${articleAgeHours.toFixed(1)}h old): "${title}"`,
        );
        return;
      }

      // 1. Deduplication Check
      const existing = await this.prisma.newsArticle.findFirst({
        where: { sourceUrl: link },
      });

      if (existing) {
        // Link entity if not already linked
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

      // 2. Create Article
      const article = await this.prisma.newsArticle.create({
        data: {
          title,
          summary,
          sourceName,
          sourceUrl: link,
          publishedAt: pubDate,
          ingestType: NewsIngestType.API,
          status: ModerationStatus.APPROVED,
        },
      });

      // 3. Create Entity Link
      await this.prisma.newsEntityMention.create({
        data: {
          articleId: article.id,
          entityType,
          entityId,
        },
      });

      this.logger.log(
        `Ingested article: "${title}" for ${entityType} #${entityId}`,
      );

      // 4. Trigger Sentiment Analysis (Non-blocking)
      const contextGeoId =
        entityType === EntityType.GEO_UNIT ? entityId : undefined;
      const fullText = `${title}. ${summary}`;

      this.sentimentService
        .analyzeAndStoreSentiment(article.id, fullText, contextGeoId)
        .catch((err) =>
          this.logger.error(`Sentiment trigger failed: ${err.message}`),
        );
    } catch (error) {
      this.logger.warn(
        `Failed to save article "${item.title}": ${error.message}`,
      );
    }
  }

  /**
   * Calculate article age in hours
   */
  private getArticleAgeInHours(pubDate: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - pubDate.getTime();
    return diffMs / (1000 * 60 * 60);
  }

  /**
   * Build enhanced query with event-based keywords
   * This creates multiple search variations to find actionable news
   */
  async buildEnhancedQuery(
    entityType: EntityType,
    entityId: number,
  ): Promise<string[]> {
    const baseQuery = await this.keywordManager.buildSearchQuery(
      entityType,
      entityId,
    );

    if (!baseQuery) {
      return [];
    }

    // For candidates, create event-based variations
    if (entityType === EntityType.CANDIDATE) {
      const queries: string[] = [];

      // Add base query
      queries.push(baseQuery);

      // Add top event-based variations (limit to avoid too many requests)
      const topEventKeywords = EVENT_KEYWORDS.slice(0, 3);
      for (const keyword of topEventKeywords) {
        queries.push(`${baseQuery} "${keyword}"`);
      }

      return queries;
    }

    return [baseQuery];
  }
}

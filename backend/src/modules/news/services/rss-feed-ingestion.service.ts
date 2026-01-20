import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { SentimentAnalysisService } from './sentiment-analysis.service';
import { BANGALORE_NEWS_SOURCES, NewsSource } from '../config/news-sources.config';
import { EntityType, NewsIngestType, ModerationStatus } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Parser = require('rss-parser');

/**
 * RSS Feed Ingestion Service
 * 
 * Handles ingestion from direct RSS feeds (The Hindu, TOI, etc.)
 * Implements post-processing filters based on article age
 */
@Injectable()
export class RssFeedIngestionService {
    private readonly logger = new Logger(RssFeedIngestionService.name);
    private readonly parser = new Parser();
    private readonly maxArticleAgeHours: number;

    constructor(
        private prisma: PrismaService,
        private sentimentService: SentimentAnalysisService,
        private configService: ConfigService,
    ) {
        this.maxArticleAgeHours = this.configService.get<number>(
            'NEWS_ARTICLE_MAX_AGE_HOURS',
            48,
        );
    }

    /**
     * Fetch news from all configured RSS sources
     */
    async fetchFromAllSources(): Promise<void> {
        this.logger.log(
            `Starting RSS feed ingestion from ${BANGALORE_NEWS_SOURCES.length} sources...`,
        );

        for (const source of BANGALORE_NEWS_SOURCES) {
            await this.fetchFromSource(source);
            // Rate limiting between sources
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        this.logger.log('✅ RSS feed ingestion completed');
    }

    /**
     * Fetch news from a specific RSS source
     */
    async fetchFromSource(source: NewsSource): Promise<void> {
        try {
            this.logger.debug(`Fetching from ${source.name}...`);

            const feed = await this.parser.parseURL(source.url);

            let processedCount = 0;
            let skippedOldCount = 0;
            let skippedDuplicateCount = 0;

            for (const item of feed.items) {
                const result = await this.processRssItem(item, source);

                if (result === 'processed') processedCount++;
                else if (result === 'too_old') skippedOldCount++;
                else if (result === 'duplicate') skippedDuplicateCount++;
            }

            this.logger.log(
                `${source.name}: Processed ${processedCount}, Skipped (old: ${skippedOldCount}, duplicate: ${skippedDuplicateCount})`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to fetch from ${source.name}: ${error.message}`,
            );
        }
    }

    /**
     * Process a single RSS item with freshness filtering
     */
    private async processRssItem(
        item: any,
        source: NewsSource,
    ): Promise<'processed' | 'too_old' | 'duplicate'> {
        try {
            const title = item.title;
            const link = item.link;
            const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
            const summary = item.contentSnippet || item.content || item.description || title;

            // ✅ CRITICAL: Post-processing filter - Check article age
            const articleAgeHours = this.getArticleAgeInHours(pubDate);
            if (articleAgeHours > this.maxArticleAgeHours) {
                this.logger.debug(
                    `Skipping old article (${articleAgeHours.toFixed(1)}h old): "${title}"`,
                );
                return 'too_old';
            }

            // Check for duplicates
            const existing = await this.prisma.newsArticle.findFirst({
                where: { sourceUrl: link },
            });

            if (existing) {
                return 'duplicate';
            }

            // Create article
            const article = await this.prisma.newsArticle.create({
                data: {
                    title,
                    summary,
                    sourceName: source.name,
                    sourceUrl: link,
                    publishedAt: pubDate,
                    ingestType: NewsIngestType.API, // Using API type for RSS feeds
                    status: ModerationStatus.APPROVED,
                },
            });

            this.logger.log(
                `Ingested: "${title}" (${articleAgeHours.toFixed(1)}h old)`,
            );

            // Trigger sentiment analysis (non-blocking)
            const fullText = `${title}. ${summary}`;
            this.sentimentService
                .analyzeAndStoreSentiment(article.id, fullText)
                .catch((err) =>
                    this.logger.error(`Sentiment analysis failed: ${err.message}`),
                );

            // TODO: Entity linking - match article to relevant entities
            // This can be done via keyword matching or NLP entity extraction
            await this.linkArticleToEntities(article.id, fullText);

            return 'processed';
        } catch (error) {
            this.logger.warn(
                `Failed to process RSS item "${item.title}": ${error.message}`,
            );
            return 'duplicate'; // Treat errors as duplicates to continue processing
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
     * Link article to relevant entities based on keyword matching
     * This is a simple implementation - can be enhanced with NLP
     */
    private async linkArticleToEntities(
        articleId: number,
        fullText: string,
    ): Promise<void> {
        try {
            const lowerText = fullText.toLowerCase();

            // Find candidates mentioned in the article
            const candidates = await this.prisma.candidate.findMany({
                select: { id: true, fullName: true },
            });

            for (const candidate of candidates) {
                const candidateName = candidate.fullName.toLowerCase();
                if (lowerText.includes(candidateName)) {
                    // Check if link already exists
                    const existingLink = await this.prisma.newsEntityMention.findFirst({
                        where: {
                            articleId,
                            entityType: EntityType.CANDIDATE,
                            entityId: candidate.id,
                        },
                    });

                    if (!existingLink) {
                        await this.prisma.newsEntityMention.create({
                            data: {
                                articleId,
                                entityType: EntityType.CANDIDATE,
                                entityId: candidate.id,
                            },
                        });
                        this.logger.debug(
                            `Linked article #${articleId} to candidate: ${candidate.fullName}`,
                        );
                    }
                }
            }

            // TODO: Similarly link to parties and constituencies
        } catch (error) {
            this.logger.error(
                `Failed to link article #${articleId} to entities: ${error.message}`,
            );
        }
    }
}

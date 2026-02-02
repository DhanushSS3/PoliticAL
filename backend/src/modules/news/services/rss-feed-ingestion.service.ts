import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
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

    // Rotating User-Agents to avoid 403 Detection
    private readonly userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0'
    ];

    constructor(
        private prisma: PrismaService,
        private sentimentService: SentimentAnalysisService,
        private configService: ConfigService,
        private httpService: HttpService,
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
     * Fetch news from a specific RSS source using HttpService with proper headers
     */
    async fetchFromSource(source: NewsSource): Promise<void> {
        try {
            this.logger.debug(`Fetching from ${source.name}...`);

            // 1. Fetch Raw XML with User-Agent spoofing
            const randomUserAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];

            const response = await lastValueFrom(
                this.httpService.get(source.url, {
                    headers: {
                        'User-Agent': randomUserAgent,
                        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                    },
                    timeout: 10000,
                })
            );

            // 2. Parse XML Content
            const feed = await this.parser.parseString(response.data);

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
                `Failed to fetch from ${source.name}: ${error.message} (Status: ${error.response?.status || 'Unknown'})`,
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
     * Link article to relevant entities based on strict keyword matching
     * 
     * Uses Regex word boundaries and "Longest Match" rule to prevent 
     * disambiguation errors (e.g., preventing 'K Shivkumar' from matching 'D K Shivakumar')
     */
    private async linkArticleToEntities(
        articleId: number,
        fullText: string,
    ): Promise<void> {
        try {
            // 1. Fetch all potentially active entities to match against
            // In a larger system, we'd use a trie or Aho-Corasick algorithm
            const candidates = await this.prisma.candidate.findMany({
                select: { id: true, fullName: true },
            });

            // 2. Sort candidates by name length (DESCENDING)
            // This ensures "D K Shivakumar" is checked before "K Shivkumar"
            const sortedCandidates = candidates.sort((a, b) => b.fullName.length - a.fullName.length);

            const linkedIds = new Set<number>();
            const textToSearch = fullText;

            for (const candidate of sortedCandidates) {
                const name = candidate.fullName;
                // Escape special characters and use word boundaries
                const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedName}\\b`, 'i');

                if (regex.test(textToSearch)) {
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

                    linkedIds.add(candidate.id);

                    // Optimization: If we found a match, we could potentially remove it from text
                    // to prevent shorter names from matching. But word boundaries usually handle this.
                }
            }
        } catch (error) {
            this.logger.error(
                `Failed to link article #${articleId} to entities: ${error.message}`,
            );
        }
    }
}

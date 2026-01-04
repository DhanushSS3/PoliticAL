import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { DataSourceType, SentimentLabel } from '@prisma/client';

interface SentimentResponse {
    label: string; // POSITIVE, NEUTRAL, NEGATIVE
    score: number;
    confidence: number;
    model_version: string;
}

@Injectable()
export class SentimentAnalysisService {
    private readonly logger = new Logger(SentimentAnalysisService.name);
    private readonly analysisServiceUrl: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        // Default to localhost:8000 if not configured
        this.analysisServiceUrl = this.configService.get<string>('ANALYSIS_SERVICE_URL') || 'http://localhost:8000';
    }

    /**
     * Analyze an article and store the sentiment signal
     * @param articleId The ID of the NewsArticle
     * @param content The text content to analyze
     * @param geoUnitId Optional explicit geoUnitId, otherwise inferred (future) or defaults to global/state
     */
    async analyzeAndStoreSentiment(articleId: number, content: string, geoUnitId?: number) {
        try {
            this.logger.debug(`Requesting sentiment analysis for article #${articleId}`);

            // 1. Call Python Microservice
            const { data } = await firstValueFrom(
                this.httpService.post<SentimentResponse>(`${this.analysisServiceUrl}/analyze/sentiment`, {
                    content,
                    language: 'auto', // Python service handles detection
                    context: 'political_news'
                })
            );

            this.logger.debug(`Received sentiment: ${data.label} (${data.score})`);

            // 2. Determine GeoUnit(s)
            // v1 Simplification: If article is linked to a specific GeoUnit entity, use that.
            // If linked to multiple, we might need multiple signals or an aggregate.
            // For now, let's look up the linked entities.

            let targetGeoUnitIds: number[] = [];

            if (geoUnitId) {
                targetGeoUnitIds.push(geoUnitId);
            } else {
                // Find linked GeoUnits
                const links = await this.prisma.newsEntityMention.findMany({
                    where: { articleId, entityType: 'GEO_UNIT' },
                });
                targetGeoUnitIds = links.map(l => l.entityId);

                // If no direct GeoUnit link, maybe link to parent state? 
                // For MVP, if no geo link, we might skip sentiment storage or assign to a default "State" level unit.
                // Let's assume for now we only store if we have a target.
            }

            if (targetGeoUnitIds.length === 0) {
                this.logger.warn(`No GeoUnit linked for article #${articleId}, skipping sentiment storage.`);
                return;
            }

            // 3. Store Signal for each linked GeoUnit
            for (const gid of targetGeoUnitIds) {
                await this.prisma.sentimentSignal.create({
                    data: {
                        geoUnitId: gid,
                        sourceType: DataSourceType.NEWS,
                        sourceRefId: articleId,
                        sentiment: data.label as SentimentLabel,
                        sentimentScore: data.score,
                        confidence: data.confidence,
                        modelVersion: data.model_version,
                    },
                });
            }

            this.logger.log(`Sentiment stored for article #${articleId}`);

        } catch (error) {
            this.logger.error(`Sentiment analysis failed for article #${articleId}: ${error.message}`);
            // Non-blocking: we catch error so ingestion continues
        }
    }
}

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { GeoAttributionResolverService } from './geo-attribution-resolver.service';
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
        private readonly geoResolver: GeoAttributionResolverService,
    ) {
        // Default to localhost:8000 if not configured
        this.analysisServiceUrl = this.configService.get<string>('ANALYSIS_SERVICE_URL') || 'http://localhost:8000';
    }

    /**
     * Analyze an article and store the sentiment signal
     * @param articleId The ID of the NewsArticle
     * @param content The text content to analyze
     * @param geoUnitId Optional explicit geoUnitId (overrides resolver)
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

            // 2. Determine GeoUnit(s) using waterfall resolver
            let targetGeoUnitIds: number[] = [];

            if (geoUnitId) {
                // Explicit override provided (e.g., from manual ingestion)
                targetGeoUnitIds.push(geoUnitId);
                this.logger.debug(`Using explicit geoUnitId: ${geoUnitId}`);
            } else {
                // Use geo attribution resolver
                targetGeoUnitIds = await this.geoResolver.resolveGeoUnits(articleId);
            }

            if (targetGeoUnitIds.length === 0) {
                this.logger.warn(`Could not resolve any GeoUnit for article #${articleId}. Sentiment will not be stored.`);
                return;
            }

            // 3. Store Signal for each resolved GeoUnit
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

            this.logger.log(`✅ Sentiment stored for article #${articleId} across ${targetGeoUnitIds.length} GeoUnit(s)`);

        } catch (error) {
            this.logger.error(`Sentiment analysis failed for article #${articleId}: ${error.message}`);
            // Non-blocking: we catch error so ingestion continues
        }
    }
}

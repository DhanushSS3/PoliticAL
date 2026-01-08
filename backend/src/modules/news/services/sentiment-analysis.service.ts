import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../prisma/prisma.service";
import { GeoAttributionResolverService } from "./geo-attribution-resolver.service";
import { RelevanceCalculatorService } from "../../analytics/services/relevance-calculator.service";
import { firstValueFrom } from "rxjs";
import { DataSourceType, EntityType, SentimentLabel } from "@prisma/client";

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
    private readonly relevanceCalculator: RelevanceCalculatorService,
  ) {
    // Default to localhost:8000 if not configured
    this.analysisServiceUrl =
      this.configService.get<string>("ANALYSIS_SERVICE_URL") ||
      "http://localhost:8000";
  }

  /**
   * Analyze an article and store the sentiment signal
   * @param articleId The ID of the NewsArticle
   * @param content The text content to analyze
   * @param explicitGeoUnitId Optional explicit geoUnitId (overrides resolver)
   */
  async analyzeAndStoreSentiment(
    articleId: number,
    content: string,
    explicitGeoUnitId?: number,
  ) {
    try {
      this.logger.debug(
        `Requesting sentiment analysis for article #${articleId}`,
      );

      // 1. Call Python Microservice
      const { data } = await firstValueFrom(
        this.httpService.post<SentimentResponse>(
          `${this.analysisServiceUrl}/analyze/sentiment`,
          {
            content,
            language: "auto", // Python service handles detection
            context: "political_news",
          },
        ),
      );

      this.logger.debug(`Received sentiment: ${data.label} (${data.score})`);

      // 2. Determine GeoUnit(s) using waterfall resolver
      let resolutions: Array<{
        geoUnitId: number;
        sourceEntityType?: EntityType;
        sourceEntityId?: number;
      }> = [];

      if (explicitGeoUnitId) {
        // Explicit override provided (e.g., from manual ingestion)
        resolutions.push({
          geoUnitId: explicitGeoUnitId,
          // No source entity for explicit manual override, defaults to low weight or could be passed
        });
        this.logger.debug(`Using explicit geoUnitId: ${explicitGeoUnitId}`);
      } else {
        // Use geo attribution resolver
        resolutions = await this.geoResolver.resolveGeoUnits(articleId);
      }

      if (resolutions.length === 0) {
        this.logger.warn(
          `Could not resolve any GeoUnit for article #${articleId}. Sentiment will not be stored.`,
        );
        return;
      }

      // 3. Store Signal for each resolved GeoUnit
      for (const res of resolutions) {
        const relevanceWeight = this.relevanceCalculator.getBaseWeight(
          res.sourceEntityType || null,
        );

        await this.prisma.sentimentSignal.create({
          data: {
            geoUnitId: res.geoUnitId,
            sourceType: DataSourceType.NEWS,
            sourceRefId: articleId,
            sentiment: data.label as SentimentLabel,
            sentimentScore: data.score,
            confidence: data.confidence,
            modelVersion: data.model_version,

            // ✨ Feature 1: Relevance Weights
            relevanceWeight,
            sourceEntityType: res.sourceEntityType,
            sourceEntityId: res.sourceEntityId,
          },
        });
      }

      this.logger.log(
        `✅ Sentiment stored for article #${articleId} across ${resolutions.length} GeoUnit(s)`,
      );
    } catch (error) {
      this.logger.error(
        `Sentiment analysis failed for article #${articleId}: ${error.message}`,
      );
      // Non-blocking: we catch error so ingestion continues
    }
  }
}

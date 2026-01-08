import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../../prisma/prisma.service";
import { ISSUE_KEYWORDS } from "../data/issue-keywords";

/**
 * DailyGeoStatsService
 *
 * Computes daily aggregated statistics for each GeoUnit.
 * - Average sentiment
 * - Pulse score
 * - Dominant issue extraction (Feature 3)
 *
 * Runs as a nightly batch job.
 */
@Injectable()
export class DailyGeoStatsService {
  private readonly logger = new Logger(DailyGeoStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Nightly batch job to compute daily stats
   * Runs at 23:59 every day
   */
  @Cron("59 23 * * *")
  async computeDailyStats() {
    this.logger.log("Starting nightly DailyGeoStats computation...");
    const jobStart = new Date();

    try {
      // Get all active GeoUnits (or all GeoUnits? Better all to have history)
      // But for MVP scale, let's process all GeoUnits that had activity today
      // Optimization: Only compute for GeoUnits that have signals today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const activeGeoUnitIds = await this.prisma.sentimentSignal.findMany({
        where: {
          createdAt: { gte: startOfDay },
        },
        select: { geoUnitId: true },
        distinct: ["geoUnitId"],
      });

      this.logger.log(
        `Found ${activeGeoUnitIds.length} GeoUnits with activity today`,
      );

      let processed = 0;
      for (const { geoUnitId } of activeGeoUnitIds) {
        await this.computeStatsForGeoUnit(geoUnitId, startOfDay);
        processed++;
        if (processed % 50 === 0) {
          this.logger.debug(
            `Processed ${processed}/${activeGeoUnitIds.length} active GeoUnits`,
          );
        }
      }

      this.logger.log(
        `✅ Daily stats completed. Processed ${processed} GeoUnits.`,
      );
    } catch (error) {
      this.logger.error(`Failed to compute daily stats: ${error.message}`);
    }
  }

  /**
   * Compute and store stats for a specific GeoUnit for a specific date
   */
  async computeStatsForGeoUnit(geoUnitId: number, date: Date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch signals for the day
    const signals = await this.prisma.sentimentSignal.findMany({
      where: {
        geoUnitId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        newsArticle: true, // Need text for issue extraction
      },
    });

    if (signals.length === 0) return;

    // Calculate metrics
    const avgSentiment = this.calculateAverageSentiment(signals);
    const pulseScore = this.calculatePulseScore(signals);
    const dominantIssue = this.extractDominantIssue(signals);

    // Store result
    await this.prisma.dailyGeoStats.upsert({
      where: {
        geoUnitId_date: {
          geoUnitId,
          date: startOfDay, // Store with time 00:00:00
        },
      },
      create: {
        geoUnitId,
        date: startOfDay,
        avgSentiment,
        pulseScore,
        dominantIssue,
      },
      update: {
        avgSentiment,
        pulseScore,
        dominantIssue,
      },
    });
  }

  /**
   * Calculate simple average sentiment (-1.0 to 1.0)
   */
  private calculateAverageSentiment(signals: any[]): number {
    if (signals.length === 0) return 0;
    const sum = signals.reduce((acc, s) => acc + s.sentimentScore, 0);
    return parseFloat((sum / signals.length).toFixed(2));
  }

  /**
   * Calculate weighted pulse score
   * Uses confidence and relevance (if available)
   */
  private calculatePulseScore(signals: any[]): number {
    if (signals.length === 0) return 0;

    const sum = signals.reduce((acc, s) => {
      const weight = s.relevanceWeight || 1.0;
      return acc + s.sentimentScore * s.confidence * weight;
    }, 0);

    return parseFloat((sum / signals.length).toFixed(2));
  }

  /**
   * Extract the dominant issue from article texts
   */
  private extractDominantIssue(signals: any[]): string | null {
    // Collect text from unique articles to avoid skewing by multiple signals per article
    const uniqueArticles = new Map<number, string>();

    for (const signal of signals) {
      if (signal.newsArticle) {
        uniqueArticles.set(
          signal.newsArticle.id,
          `${signal.newsArticle.title} ${signal.newsArticle.summary}`,
        );
      }
    }

    if (uniqueArticles.size === 0) return null;

    const allText = Array.from(uniqueArticles.values()).join(" ").toLowerCase();

    // Count keywords
    const scores: Record<string, number> = {};

    for (const [key, category] of Object.entries(ISSUE_KEYWORDS)) {
      let count = 0;
      for (const keyword of category.keywords) {
        // Simple string match count
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        const matches = allText.match(regex);
        if (matches) {
          count += matches.length;
        }
      }
      scores[category.label] = count * category.weight;
    }

    // Find highest score
    let maxScore = 0;
    let dominantLabel: string | null = null;

    for (const [label, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        dominantLabel = label;
      }
    }

    return dominantLabel;
  }

  /**
   * Helper to get stats (API endpoint usage)
   */
  async getDailyStats(geoUnitId: number, days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.prisma.dailyGeoStats.findMany({
      where: {
        geoUnitId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: "asc" },
    });
  }
}

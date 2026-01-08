import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../../prisma/prisma.service";
import { CandidatePulseService } from "./candidate-pulse.service";
import { AlertType, SentimentLabel } from "@prisma/client";

/**
 * AlertService
 *
 * Detects sentiment anomalies and creates user alerts.
 * Implements three alert types:
 * 1. Sentiment Spike: Sudden change in pulse (Δ ≥ 0.35)
 * 2. Negative Surge: Multiple negative articles in short time
 * 3. High-Confidence Hit: Single high-impact negative article
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles alert detection and creation
 * - Strategy Pattern: Different alert types use different detection strategies
 */
@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  // Alert thresholds
  private readonly SPIKE_THRESHOLD = 0.35;
  private readonly SPIKE_MIN_SIGNALS = 3;
  private readonly SURGE_MIN_COUNT = 3;
  private readonly SURGE_MIN_CONFIDENCE = 0.8;
  private readonly HIT_SCORE_THRESHOLD = -0.7;
  private readonly HIT_CONFIDENCE_THRESHOLD = 0.9;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pulseService: CandidatePulseService,
  ) {}

  /**
   * Hourly job to detect and create alerts
   * Runs for all candidates with active subscriptions
   */
  @Cron(CronExpression.EVERY_HOUR)
  async detectAlerts() {
    this.logger.log("Starting hourly alert detection...");

    try {
      // Get all candidates with profiles (future: filter by active subscriptions)
      const candidates = await this.prisma.candidateProfile.findMany({
        include: {
          candidate: true,
          user: true, // Will be null for opponents
        },
      });

      for (const profile of candidates) {
        await this.checkCandidateAlerts(profile.candidateId, profile.userId);
      }

      this.logger.log(
        `Alert detection completed for ${candidates.length} candidates`,
      );
    } catch (error) {
      this.logger.error(`Alert detection failed: ${error.message}`);
    }
  }

  /**
   * Check all alert types for a specific candidate
   *
   * @param candidateId - Candidate to check
   * @param userId - User to send alerts to (null if no subscriber)
   */
  private async checkCandidateAlerts(
    candidateId: number,
    userId: number | null,
  ) {
    if (!userId) {
      // No user linked, skip alerts (opponent or unsubscribed candidate)
      return;
    }

    try {
      // Check all alert types
      await this.checkSentimentSpike(candidateId, userId);
      await this.checkNegativeSurge(candidateId, userId);
      await this.checkHighConfidenceHits(candidateId, userId);
    } catch (error) {
      this.logger.warn(
        `Alert check failed for candidate #${candidateId}: ${error.message}`,
      );
    }
  }

  /**
   * Alert Type 1: Sentiment Spike
   * Detects sudden changes in pulse score compared to baseline
   */
  private async checkSentimentSpike(candidateId: number, userId: number) {
    // Get today's pulse
    const todayPulse = await this.pulseService.calculatePulse(candidateId, 1);

    if (todayPulse.articlesAnalyzed < this.SPIKE_MIN_SIGNALS) {
      return; // Not enough data
    }

    // Get 7-day baseline (excluding today)
    const baselinePulse = await this.pulseService.calculatePulse(
      candidateId,
      7,
    );

    const delta = Math.abs(todayPulse.pulseScore - baselinePulse.pulseScore);

    if (delta >= this.SPIKE_THRESHOLD) {
      const direction =
        todayPulse.pulseScore > baselinePulse.pulseScore
          ? "positive"
          : "negative";
      const message = `🚨 Sentiment ${direction} spike detected! Change: ${delta.toFixed(2)} (${this.SPIKE_MIN_SIGNALS}+ articles in last 24h)`;

      await this.createAlert(
        userId,
        candidateId,
        AlertType.SENTIMENT_SPIKE,
        message,
      );
      this.logger.log(`Spike alert created for candidate #${candidateId}`);
    }
  }

  /**
   * Alert Type 2: Negative Surge
   * Detects multiple negative articles in short time window
   */
  private async checkNegativeSurge(candidateId: number, userId: number) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Get signals from last 24 hours
    const recentSignals = await this.prisma.sentimentSignal.findMany({
      where: {
        createdAt: { gte: yesterday },
        sentiment: SentimentLabel.NEGATIVE,
        confidence: { gte: this.SURGE_MIN_CONFIDENCE },
        newsArticle: {
          entityMentions: {
            some: {
              entityType: "CANDIDATE",
              entityId: candidateId,
            },
          },
        },
      },
    });

    if (recentSignals.length >= this.SURGE_MIN_COUNT) {
      const message = `⚠️ Negative coverage surge: ${recentSignals.length} high-confidence negative articles detected in last 24 hours`;

      await this.createAlert(
        userId,
        candidateId,
        AlertType.CONTROVERSY,
        message,
      );
      this.logger.log(`Surge alert created for candidate #${candidateId}`);
    }
  }

  /**
   * Alert Type 3: High-Confidence Hit
   * Detects single high-impact negative article
   */
  private async checkHighConfidenceHits(candidateId: number, userId: number) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Find high-impact negative signals
    const criticalSignals = await this.prisma.sentimentSignal.findMany({
      where: {
        createdAt: { gte: yesterday },
        sentimentScore: { lte: this.HIT_SCORE_THRESHOLD },
        confidence: { gte: this.HIT_CONFIDENCE_THRESHOLD },
        newsArticle: {
          entityMentions: {
            some: {
              entityType: "CANDIDATE",
              entityId: candidateId,
            },
          },
        },
      },
      include: {
        newsArticle: true,
      },
    });

    for (const signal of criticalSignals) {
      // Check if we already alerted for this article
      const existing = await this.prisma.alert.findFirst({
        where: {
          userId,
          message: { contains: signal.newsArticle.title },
        },
      });

      if (!existing) {
        const message = `🔴 High-impact negative coverage: "${signal.newsArticle.title}" (Confidence: ${(signal.confidence * 100).toFixed(0)}%)`;

        // Get geoUnitId for the alert
        const geoUnitId = signal.geoUnitId;

        await this.createAlert(
          userId,
          candidateId,
          AlertType.NEWS_MENTION,
          message,
          geoUnitId,
        );
        this.logger.log(
          `High-impact alert created for candidate #${candidateId}`,
        );
      }
    }
  }

  /**
   * Create an alert in the database
   */
  private async createAlert(
    userId: number,
    candidateId: number,
    type: AlertType,
    message: string,
    geoUnitId?: number,
  ) {
    // Get candidate's primary geo if not provided
    if (!geoUnitId) {
      const profile = await this.prisma.candidateProfile.findUnique({
        where: { candidateId },
      });
      geoUnitId = profile?.primaryGeoUnitId || 1; // Fallback to ID 1 if not found
    }

    await this.prisma.alert.create({
      data: {
        userId,
        geoUnitId,
        type,
        message,
        isRead: false,
      },
    });
  }

  /**
   * Manual trigger for testing
   */
  async triggerAlertDetection() {
    this.logger.log("Manual alert detection triggered");
    await this.detectAlerts();
  }
}

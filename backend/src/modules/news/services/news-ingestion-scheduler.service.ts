import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../../prisma/prisma.service";
import { NewsIngestionService } from "./news-ingestion.service";

/**
 * NewsIngestionSchedulerService
 *
 * Implements Priority-Based News Fetching (Feature 2).
 * Schedules ingestion jobs based on entity priority levels.
 *
 * Priorities:
 * Tier 1 (priority >= 8): Every 1 hour
 * Tier 2 (priority 5-7): Every 2 hours
 * Tier 3 (priority <= 4): Every 6 hours
 */
@Injectable()
export class NewsIngestionSchedulerService {
  private readonly logger = new Logger(NewsIngestionSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly newsIngestion: NewsIngestionService,
  ) { }

  /**
   * Tier 1: High Priority (Candidates, Parties, Constituencies)
   * Runs every hour (00:00, 01:00, ...)
   * 
   * ⚠️ DISABLED: Now using worker-based queue system (NewsQueueSchedulerService)
   */
  // @Cron(CronExpression.EVERY_HOUR)
  async scheduleTier1() {
    this.logger.log("🕒 Starting TIER 1 news ingestion (Priority >= 8)...");
    await this.runIngestionForTier(8, 10);
  }

  /**
   * Tier 2: Medium Priority (Districts, Dependent Queues)
   * Runs every 2 hours (00:00, 02:00, ...)
   * 
   * ⚠️ DISABLED: Now using worker-based queue system (NewsQueueSchedulerService)
   */
  // @Cron("0 0 */2 * * *")
  async scheduleTier2() {
    this.logger.log("🕒 Starting TIER 2 news ingestion (Priority 5-7)...");
    await this.runIngestionForTier(5, 7);
  }

  /**
   * Tier 3: Low Priority (States, National, Background)
   * Runs every 6 hours (00:00, 06:00, ...)
   * 
   * ⚠️ DISABLED: Now using worker-based queue system (NewsQueueSchedulerService)
   */
  // @Cron("0 0 */6 * * *")
  async scheduleTier3() {
    this.logger.log("🕒 Starting TIER 3 news ingestion (Priority <= 4)...");
    await this.runIngestionForTier(0, 4);
  }

  /**
   * Common logic to run ingestion for a priority range
   */
  private async runIngestionForTier(minPriority: number, maxPriority: number) {
    try {
      const entities = await this.prisma.entityMonitoring.findMany({
        where: {
          isActive: true,
          priority: {
            gte: minPriority,
            lte: maxPriority,
          },
        },
        select: {
          entityType: true,
          entityId: true,
          priority: true,
        },
      });

      if (entities.length === 0) {
        this.logger.debug(
          `No active entities found for priority range ${minPriority}-${maxPriority}`,
        );
        return;
      }

      this.logger.log(
        `Found ${entities.length} entities for priority range ${minPriority}-${maxPriority}`,
      );

      for (const entity of entities) {
        try {
          await this.newsIngestion.fetchNewsForEntity(
            entity.entityType,
            entity.entityId,
          );
          // Add slight delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (err) {
          this.logger.error(
            `Failed to ingest for ${entity.entityType} #${entity.entityId}: ${err.message}`,
          );
        }
      }

      this.logger.log(
        `✅ Completed ingestion for priority range ${minPriority}-${maxPriority}`,
      );
    } catch (error) {
      this.logger.error(
        `Error in scheduler for range ${minPriority}-${maxPriority}: ${error.message}`,
      );
    }
  }
}

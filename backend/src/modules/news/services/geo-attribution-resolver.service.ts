import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { EntityType } from "@prisma/client";

/**
 * GeoAttributionResolverService
 *
 * Implements the waterfall geo-resolution strategy:
 * 1. Check if article has GEO_UNIT entity mention → use it
 * 2. Else check CANDIDATE mention → lookup candidate.profile.primaryGeoUnitId
 * 3. Else check PARTY mention → lookup party's state-level GeoUnit
 * 4. Else → fallback to Karnataka state GeoUnit
 *
 * SOLID Principles:
 * - Single Responsibility: Only responsible for GeoUnit resolution
 * - Open/Closed: Extensible via configuration
 */
@Injectable()
export class GeoAttributionResolverService {
  private readonly logger = new Logger(GeoAttributionResolverService.name);
  private fallbackStateGeoUnitId: number | null = null;

  constructor(private readonly prisma: PrismaService) {
    this.initializeFallback();
  }

  /**
   * Initialize fallback state GeoUnit (Karnataka)
   * This runs once on service initialization
   */
  private async initializeFallback() {
    const state = await this.prisma.geoUnit.findFirst({
      where: { name: "Karnataka", level: "STATE" },
    });
    if (state) {
      this.fallbackStateGeoUnitId = state.id;
      this.logger.log(
        `Fallback state GeoUnit initialized: Karnataka (ID: ${state.id})`,
      );
    } else {
      this.logger.warn(
        'Fallback state GeoUnit not found. Ensure "Karnataka" state is seeded.',
      );
    }
  }

  /**
   * Resolve GeoUnit IDs for an article using waterfall logic
   *
   * @param articleId - The NewsArticle ID
   * @returns Array of GeoUnit resolution objects with source tracking
   */
  async resolveGeoUnits(articleId: number): Promise<
    Array<{
      geoUnitId: number;
      sourceEntityType?: EntityType;
      sourceEntityId?: number;
    }>
  > {
    const results = new Map<
      number,
      {
        geoUnitId: number;
        sourceEntityType?: EntityType;
        sourceEntityId?: number;
      }
    >();

    // Fetch all entity mentions for this article
    const mentions = await this.prisma.newsEntityMention.findMany({
      where: { articleId },
      select: {
        entityType: true,
        entityId: true,
      },
    });

    if (mentions.length === 0) {
      this.logger.debug(`Article #${articleId} has no entity mentions`);
      return this.getFallback();
    }

    // Step 1: Check for explicit GEO_UNIT mentions
    const geoMentions = mentions.filter(
      (m) => m.entityType === EntityType.GEO_UNIT,
    );
    if (geoMentions.length > 0) {
      geoMentions.forEach((m) => {
        results.set(m.entityId, {
          geoUnitId: m.entityId,
          sourceEntityType: EntityType.GEO_UNIT,
          sourceEntityId: m.entityId,
        });
      });
      this.logger.debug(
        `Article #${articleId} has explicit GeoUnit mentions: ${results.size}`,
      );
      return Array.from(results.values());
    }

    // Step 2: Check for CANDIDATE mentions → resolve their constituency
    const candidateMentions = mentions.filter(
      (m) => m.entityType === EntityType.CANDIDATE,
    );
    if (candidateMentions.length > 0) {
      for (const mention of candidateMentions) {
        const profile = await this.prisma.candidateProfile.findUnique({
          where: { candidateId: mention.entityId },
          select: { primaryGeoUnitId: true },
        });

        if (profile) {
          results.set(profile.primaryGeoUnitId, {
            geoUnitId: profile.primaryGeoUnitId,
            sourceEntityType: EntityType.CANDIDATE,
            sourceEntityId: mention.entityId,
          });
        }
      }

      if (results.size > 0) {
        this.logger.debug(
          `Article #${articleId} resolved via CANDIDATE mentions: ${results.size}`,
        );
        return Array.from(results.values());
      }
    }

    // Step 3: Check for PARTY mentions → resolve to state level
    const partyMentions = mentions.filter(
      (m) => m.entityType === EntityType.PARTY,
    );
    if (partyMentions.length > 0 && this.fallbackStateGeoUnitId) {
      const party = partyMentions[0]; // Just pick the first party mention for tracking
      results.set(this.fallbackStateGeoUnitId, {
        geoUnitId: this.fallbackStateGeoUnitId,
        sourceEntityType: EntityType.PARTY,
        sourceEntityId: party.entityId,
      });
      this.logger.debug(
        `Article #${articleId} resolved via PARTY mention to state level`,
      );
      return Array.from(results.values());
    }

    // Step 4: Ultimate fallback
    return this.getFallback();
  }

  /**
   * Get fallback GeoUnit (state level)
   */
  private getFallback(): Array<{
    geoUnitId: number;
    sourceEntityType?: EntityType;
    sourceEntityId?: number;
  }> {
    if (this.fallbackStateGeoUnitId) {
      this.logger.debug(
        `Using fallback state GeoUnit: ${this.fallbackStateGeoUnitId}`,
      );
      return [
        {
          geoUnitId: this.fallbackStateGeoUnitId,
          // No source entity for fallback
        },
      ];
    }
    this.logger.warn("No fallback state GeoUnit available");
    return [];
  }
}

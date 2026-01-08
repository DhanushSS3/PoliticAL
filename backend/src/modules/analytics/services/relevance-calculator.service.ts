import { Injectable } from "@nestjs/common";
import { EntityType } from "@prisma/client";

/**
 * RelevanceCalculatorService
 *
 * Calculates relevance weight based on entity match type.
 * This determines how much weight to give a sentiment signal based on
 * whether it's about the candidate directly, their constituency, their party, etc.
 *
 * SOLID Principles:
 * - Single Responsibility: Only calculates relevance weights
 * - Open/Closed: Weights are configurable and extensible
 */
@Injectable()
export class RelevanceCalculatorService {
  /**
   * Relevance weights by entity type
   * Higher weight = more directly relevant to the candidate
   */
  private readonly WEIGHTS = {
    [EntityType.CANDIDATE]: 1.0, // Direct mention of candidate
    [EntityType.GEO_UNIT]: 0.8, // About their constituency
    [EntityType.PARTY]: 0.6, // About their party
    STATE_FALLBACK: 0.4, // State-level news
  };

  /**
   * Get base relevance weight for an entity type
   * used during SentimentSignal creation
   */
  getBaseWeight(entityType: EntityType | null): number {
    if (!entityType) return this.WEIGHTS.STATE_FALLBACK;
    return this.WEIGHTS[entityType] || this.WEIGHTS.STATE_FALLBACK;
  }

  /**
   * Calculate relevance weight for a set of entity mentions
   * Returns the HIGHEST weight found (most relevant entity)
   *
   * @param entityMentions - Array of entity mentions from NewsEntityMention
   * @param targetCandidateId - The candidate we're calculating pulse for
   * @param targetPartyId - The candidate's party ID
   * @param targetGeoUnitId - The candidate's primary geo unit ID
   * @returns Relevance weight between 0.4 and 1.0
   */
  calculateRelevanceWeight(
    entityMentions: Array<{ entityType: EntityType; entityId: number }>,
    targetCandidateId: number,
    targetPartyId: number,
    targetGeoUnitId: number,
  ): number {
    if (!entityMentions || entityMentions.length === 0) {
      return this.WEIGHTS.STATE_FALLBACK;
    }

    let maxWeight = this.WEIGHTS.STATE_FALLBACK;

    for (const mention of entityMentions) {
      // Check if this mention is about the target candidate directly
      if (
        mention.entityType === EntityType.CANDIDATE &&
        mention.entityId === targetCandidateId
      ) {
        return this.WEIGHTS[EntityType.CANDIDATE]; // Highest possible, return immediately
      }

      // Check if it's about their constituency
      if (
        mention.entityType === EntityType.GEO_UNIT &&
        mention.entityId === targetGeoUnitId
      ) {
        maxWeight = Math.max(maxWeight, this.WEIGHTS[EntityType.GEO_UNIT]);
      }

      // Check if it's about their party
      if (
        mention.entityType === EntityType.PARTY &&
        mention.entityId === targetPartyId
      ) {
        maxWeight = Math.max(maxWeight, this.WEIGHTS[EntityType.PARTY]);
      }
    }

    return maxWeight;
  }

  /**
   * Get weight configuration for debugging/monitoring
   */
  getWeightConfig() {
    return { ...this.WEIGHTS };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EntityType } from '@prisma/client';

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
            where: { name: 'Karnataka', level: 'STATE' }
        });
        if (state) {
            this.fallbackStateGeoUnitId = state.id;
            this.logger.log(`Fallback state GeoUnit initialized: Karnataka (ID: ${state.id})`);
        } else {
            this.logger.warn('Fallback state GeoUnit not found. Ensure "Karnataka" state is seeded.');
        }
    }

    /**
     * Resolve GeoUnit IDs for an article using waterfall logic
     * 
     * @param articleId - The NewsArticle ID
     * @returns Array of GeoUnit IDs (can be empty if nothing resolves)
     */
    async resolveGeoUnits(articleId: number): Promise<number[]> {
        const geoUnits = new Set<number>();

        // Fetch all entity mentions for this article
        const mentions = await this.prisma.newsEntityMention.findMany({
            where: { articleId },
            select: {
                entityType: true,
                entityId: true
            }
        });

        if (mentions.length === 0) {
            this.logger.debug(`Article #${articleId} has no entity mentions`);
            return this.getFallback();
        }

        // Step 1: Check for explicit GEO_UNIT mentions
        const geoMentions = mentions.filter(m => m.entityType === EntityType.GEO_UNIT);
        if (geoMentions.length > 0) {
            geoMentions.forEach(m => geoUnits.add(m.entityId));
            this.logger.debug(`Article #${articleId} has explicit GeoUnit mentions: ${Array.from(geoUnits)}`);
            return Array.from(geoUnits);
        }

        // Step 2: Check for CANDIDATE mentions → resolve their constituency
        const candidateMentions = mentions.filter(m => m.entityType === EntityType.CANDIDATE);
        if (candidateMentions.length > 0) {
            for (const mention of candidateMentions) {
                const profile = await this.prisma.candidateProfile.findUnique({
                    where: { candidateId: mention.entityId },
                    select: { primaryGeoUnitId: true }
                });

                if (profile) {
                    geoUnits.add(profile.primaryGeoUnitId);
                }
            }

            if (geoUnits.size > 0) {
                this.logger.debug(`Article #${articleId} resolved via CANDIDATE mentions: ${Array.from(geoUnits)}`);
                return Array.from(geoUnits);
            }
        }

        // Step 3: Check for PARTY mentions → resolve to state level
        const partyMentions = mentions.filter(m => m.entityType === EntityType.PARTY);
        if (partyMentions.length > 0 && this.fallbackStateGeoUnitId) {
            geoUnits.add(this.fallbackStateGeoUnitId);
            this.logger.debug(`Article #${articleId} resolved via PARTY mention to state level: ${this.fallbackStateGeoUnitId}`);
            return Array.from(geoUnits);
        }

        // Step 4: Ultimate fallback
        return this.getFallback();
    }

    /**
     * Get fallback GeoUnit (state level)
     */
    private getFallback(): number[] {
        if (this.fallbackStateGeoUnitId) {
            this.logger.debug(`Using fallback state GeoUnit: ${this.fallbackStateGeoUnitId}`);
            return [this.fallbackStateGeoUnitId];
        }
        this.logger.warn('No fallback state GeoUnit available');
        return [];
    }
}

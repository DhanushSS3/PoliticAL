import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EntityType, NewsKeyword } from '@prisma/client';

/**
 * KeywordManagerService
 * 
 * Manages the generation and retrieval of keywords for entity-based news fetching.
 * Follows the "Hybrid Keyword System" pattern:
 * - Base keywords are auto-seeded/admin-managed in DB
 * - Query expansion matches robust terms (election, policy)
 */
@Injectable()
export class KeywordManagerService {
    private readonly logger = new Logger(KeywordManagerService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Seed default keywords for an entity
     * Called when a new entity (Candidate/GeoUnit) is created
     */
    async seedKeywordsForEntity(entityType: EntityType, entityId: number, name: string): Promise<void> {
        const keywords = this.generateBaseKeywords(entityType, name);

        for (const keyword of keywords) {
            try {
                await this.prisma.newsKeyword.create({
                    data: {
                        keyword,
                        entityType,
                        entityId,
                        isActive: true,
                        priority: 1,
                    },
                });
            } catch (error) {
                // Ignore unique constraint violations (already exists)
                if (error.code !== 'P2002') {
                    this.logger.error(`Failed to seed keyword "${keyword}": ${error.message}`);
                }
            }
        }
    }

    /**
     * Generate robust search query for an entity
     * Returns a query string like: ("Siddaramaiah" OR "Siddu") AND (election OR policy...)
     */
    async buildSearchQuery(entityType: EntityType, entityId: number): Promise<string | null> {
        const keywords = await this.prisma.newsKeyword.findMany({
            where: {
                entityType,
                entityId,
                isActive: true,
            },
            select: { keyword: true },
        });

        if (keywords.length === 0) {
            return null;
        }

        // OR-group the specific keywords
        const entityClause = keywords.map(k => `"${k.keyword}"`).join(' OR ');

        // Standard political context terms (hardcoded vocabulary for stability)
        const contextTerms = [
            'election', 'pulls', 'vote', 'campaign', 'protest',
            'policy', 'government', 'scandal', 'development', 'constituency'
        ];
        const contextClause = contextTerms.join(' OR ');

        return `(${entityClause}) AND (${contextClause})`;
    }

    /**
     * Generate canonical variations (e.g. "Name + State")
     */
    private generateBaseKeywords(entityType: EntityType, name: string): string[] {
        const keywords = [name];

        // Simple heuristic expansion (can be improved with specialized libs later)
        if (entityType === EntityType.CANDIDATE) {
            // Add "Name Karnataka" if not present
            if (!name.toLowerCase().includes('karnataka')) {
                keywords.push(`${name} Karnataka`);
            }
        } else if (entityType === EntityType.PARTY) {
            // Add "Party State"
            keywords.push(`${name} Karnataka`);
        }

        return keywords;
    }
}

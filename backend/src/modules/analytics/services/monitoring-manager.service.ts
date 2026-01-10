import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { EntityType } from "@prisma/client";
import { KeywordManagerService } from "../../news/services/keyword-manager.service";

/**
 * MonitoringManagerService
 *
 * Handles activation gating for entity monitoring.
 * When a candidate subscribes:
 * 1. Activate the candidate
 * 2. Activate their opponents (same constituency)
 * 3. Activate their party (state level)
 * 4. Activate their constituency
 * 5. Seed keywords for all activated entities
 *
 * This reduces compute usage by 80-90% by only tracking relevant entities.
 *
 * SOLID Principles:
 * - Single Responsibility: Only manages monitoring activation
 * - Open/Closed: Extensible via configuration
 */
@Injectable()
export class MonitoringManagerService {
    private readonly logger = new Logger(MonitoringManagerService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly keywordManager: KeywordManagerService,
    ) { }

    /**
     * Activate monitoring for a candidate when they subscribe
     * This triggers the cascade:
     * - Activate candidate
     * - Activate opponents in same constituency
     * - Activate party
     * - Activate constituency
     * - Seed keywords for all
     *
     * @param candidateId - The subscribing candidate
     * @param userId - The user account linked to subscription
     * @returns Summary of activated entities
     */
    async activateMonitoring(
        candidateId: number,
        userId?: number,
    ): Promise<{
        activated: number;
        entities: Array<{ type: string; id: number; reason: string }>;
    }> {
        this.logger.log(`Activating monitoring for candidate #${candidateId}`);

        const activated: Array<{ type: string; id: number; reason: string }> = [];

        // 1. Get candidate info
        const candidate = await this.prisma.candidate.findUnique({
            where: { id: candidateId },
            include: {
                party: true,
                electionResultsRaw: {
                    take: 1,
                    orderBy: { election: { year: 'desc' } },
                }
            },
        });

        if (!candidate) {
            throw new Error(`Candidate #${candidateId} not found`);
        }

        // Get profile
        // Get profile or try to auto-create from history
        let profile = await this.prisma.candidateProfile.findUnique({
            where: { candidateId },
        });

        if (!profile) {
            const latestResult = candidate.electionResultsRaw[0];
            if (!latestResult) {
                throw new BadRequestException(
                    `Candidate #${candidateId} has no profile and no election history to infer Constituency. Please seed CandidateProfile first.`,
                );
            }

            this.logger.warn(`Auto-creating profile for Candidate #${candidateId} inferred from GeoUnit #${latestResult.geoUnitId}`);

            profile = await this.prisma.candidateProfile.create({
                data: {
                    candidate: { connect: { id: candidateId } },
                    geoUnit: { connect: { id: latestResult.geoUnitId } },
                    party: { connect: { id: candidate.partyId } },
                    isSubscribed: false,
                }
            });
        }

        // 2. Mark candidate profile as subscribed
        await this.prisma.candidateProfile.update({
            where: { candidateId },
            data: {
                isSubscribed: true,
                userId,
                monitoringStartedAt: new Date(),
            },
        });

        // 3. Activate the candidate entity (Priority 10)
        await this.activateEntity(
            EntityType.CANDIDATE,
            candidateId,
            "SUBSCRIBED",
            candidateId,
            10,
        );
        activated.push({
            type: "CANDIDATE",
            id: candidateId,
            reason: "SUBSCRIBED",
        });

        // 4. Activate opponents in same constituency (Priority 9)
        const opponents = await this.prisma.candidateProfile.findMany({
            where: {
                primaryGeoUnitId: profile.primaryGeoUnitId,
                candidateId: { not: candidateId }, // Exclude self
            },
            include: {
                candidate: true,
            },
        });

        this.logger.debug(`Found ${opponents.length} opponents in constituency`);

        for (const opponent of opponents) {
            await this.activateEntity(
                EntityType.CANDIDATE,
                opponent.candidateId,
                "OPPONENT",
                candidateId,
                9, // High priority for competition
            );
            activated.push({
                type: "CANDIDATE",
                id: opponent.candidateId,
                reason: "OPPONENT",
            });
        }

        // 5. Activate the party (Priority 8)
        await this.activateEntity(
            EntityType.PARTY,
            candidate.partyId,
            "PARTY_CONTEXT",
            candidateId,
            8,
        );
        activated.push({
            type: "PARTY",
            id: candidate.partyId,
            reason: "PARTY_CONTEXT",
        });

        // 6. Activate the constituency (Priority 9)
        await this.activateEntity(
            EntityType.GEO_UNIT,
            profile.primaryGeoUnitId,
            "GEO_CONTEXT",
            candidateId,
            9, // High priority for local news
        );
        activated.push({
            type: "GEO_UNIT",
            id: profile.primaryGeoUnitId,
            reason: "GEO_CONTEXT",
        });

        // 7. Seed keywords for all activated entities
        await this.seedKeywordsForActivatedEntities(candidateId, opponents);

        this.logger.log(
            `✅ Activated monitoring for ${activated.length} entities with priority levels`,
        );

        return {
            activated: activated.length,
            entities: activated,
        };
    }

    /**
     * Activate monitoring for a specific GeoUnit (Feature 4)
     * Useful for tracking generic state/district news
     */
    async activateGeoMonitoring(geoUnitId: number): Promise<void> {
        this.logger.log(`Activating monitoring for GeoUnit #${geoUnitId}`);

        // Get GeoUnit to ensure it exists
        const geoUnit = await this.prisma.geoUnit.findUnique({
            where: { id: geoUnitId },
        });
        if (!geoUnit) throw new Error(`GeoUnit #${geoUnitId} not found`);

        // Activate with Priority 9 (Medium High)
        await this.activateEntity(
            EntityType.GEO_UNIT,
            geoUnitId,
            "SUBSCRIBED",
            0, // System/Admin triggered (0)
            9,
        );

        // Seed keywords
        await this.keywordManager.seedKeywordsForEntity(
            EntityType.GEO_UNIT,
            geoUnitId,
            geoUnit.name,
        );

        this.logger.log(`✅ Activated monitoring for GeoUnit #${geoUnitId}`);
    }

    /**
     * Deactivate monitoring when subscription ends
     */
    async deactivateMonitoring(candidateId: number): Promise<void> {
        this.logger.log(`Deactivating monitoring for candidate #${candidateId}`);

        // Mark profile as unsubscribed
        await this.prisma.candidateProfile.update({
            where: { candidateId },
            data: {
                isSubscribed: false,
                monitoringEndedAt: new Date(),
            },
        });

        // Deactivate all entities triggered by this candidate
        await this.prisma.entityMonitoring.updateMany({
            where: { triggeredByCandidateId: candidateId },
            data: { isActive: false },
        });

        this.logger.log(`✅ Deactivated monitoring for candidate #${candidateId}`);
    }

    /**
     * Get list of all actively monitored entities
     * This is what NewsIngestionService should query
     */
    async getActiveEntities(): Promise<
        Array<{ entityType: EntityType; entityId: number }>
    > {
        const monitoring = await this.prisma.entityMonitoring.findMany({
            where: { isActive: true },
            select: {
                entityType: true,
                entityId: true,
            },
        });

        return monitoring;
    }

    /**
     * Check if an entity is actively monitored
     */
    async isEntityActive(
        entityType: EntityType,
        entityId: number,
    ): Promise<boolean> {
        const monitoring = await this.prisma.entityMonitoring.findUnique({
            where: {
                entityType_entityId: {
                    entityType,
                    entityId,
                },
            },
        });

        return monitoring?.isActive ?? false;
    }

    /**
     * Private: Activate a single entity with priority
     */
    private async activateEntity(
        entityType: EntityType,
        entityId: number,
        reason: string,
        triggeredBy: number,
        priority: number = 5,
    ): Promise<void> {
        await this.prisma.entityMonitoring.upsert({
            where: {
                entityType_entityId: {
                    entityType,
                    entityId,
                },
            },
            create: {
                entityType,
                entityId,
                isActive: true,
                priority,
                reason,
                triggeredByCandidateId: triggeredBy,
            },
            update: {
                isActive: true,
                priority, // Update priority if re-activated
                reason,
                triggeredByCandidateId: triggeredBy,
                updatedAt: new Date(),
            },
        });
    }

    /**
     * Private: Seed keywords for activated entities
     */
    private async seedKeywordsForActivatedEntities(
        candidateId: number,
        opponents: Array<{ candidateId: number; candidate: { fullName: string } }>,
    ): Promise<void> {
        // Get the main candidate
        const candidate = await this.prisma.candidate.findUnique({
            where: { id: candidateId },
            include: { party: true, profile: true },
        });

        if (!candidate || !candidate.profile) return;

        // Seed for main candidate
        await this.keywordManager.seedKeywordsForEntity(
            EntityType.CANDIDATE,
            candidateId,
            candidate.fullName,
        );

        // Seed for opponents
        for (const opponent of opponents) {
            await this.keywordManager.seedKeywordsForEntity(
                EntityType.CANDIDATE,
                opponent.candidateId,
                opponent.candidate.fullName,
            );
        }

        // Seed for party
        await this.keywordManager.seedKeywordsForEntity(
            EntityType.PARTY,
            candidate.partyId,
            candidate.party.name,
        );

        // Seed for geo unit
        const geoUnit = await this.prisma.geoUnit.findUnique({
            where: { id: candidate.profile.primaryGeoUnitId },
        });

        if (geoUnit) {
            await this.keywordManager.seedKeywordsForEntity(
                EntityType.GEO_UNIT,
                geoUnit.id,
                geoUnit.name,
            );
        }

        this.logger.log(`✅ Keywords seeded for activated entities`);
    }

    /**
     * Activate monitoring for a GeoUnit and interesting candidates (Viewer Mode)
     * Called when an Analyst/Viewer is granted access to a region
     */
    async activateGeoScope(geoUnitId: number) {
        // 1. Activate GeoUnit
        await this.activateEntity(
            EntityType.GEO_UNIT,
            geoUnitId,
            "GEO_ACCESS",
            0,
            8,
        );

        const geoUnit = await this.prisma.geoUnit.findUnique({
            where: { id: geoUnitId },
        });
        if (geoUnit) {
            await this.keywordManager.seedKeywordsForEntity(
                EntityType.GEO_UNIT,
                geoUnitId,
                geoUnit.name,
            );
        }

        // 2. Activate active candidates (from latest election)
        const latestResult = await this.prisma.electionResultRaw.findFirst({
            where: { geoUnitId },
            orderBy: { election: { year: "desc" } },
            select: { electionId: true },
        });

        if (latestResult) {
            const candidates = await this.prisma.electionResultRaw.findMany({
                where: {
                    geoUnitId,
                    electionId: latestResult.electionId,
                },
                include: { candidate: true },
                take: 10, // Limit to top 10 to avoid noise from independents with 0 votes
            });

            for (const result of candidates) {
                await this.activateEntity(
                    EntityType.CANDIDATE,
                    result.candidateId,
                    "GEO_ACCESS_CONTEXT",
                    0,
                    7,
                );
                await this.keywordManager.seedKeywordsForEntity(
                    EntityType.CANDIDATE,
                    result.candidateId,
                    result.candidate.fullName,
                );
            }
        }
    }

    /**
     * Create a new Candidate and Profile (Onboarding)
     */
    async createCandidate(
        fullName: string,
        partyId: number,
        constituencyId: number,
        age?: number,
        gender?: string,
    ) {
        const candidate = await this.prisma.candidate.create({
            data: {
                fullName,
                partyId,
                age: age || 0,
                gender: gender || "UNKNOWN",
                category: "GENERAL",
            },
        });

        const profile = await this.prisma.candidateProfile.create({
            data: {
                candidate: { connect: { id: candidate.id } },
                geoUnit: { connect: { id: constituencyId } },
                party: { connect: { id: partyId } },
                isSubscribed: false,
            },
        });

        this.logger.log(`Created Candidate #${candidate.id} and Profile`);
        return { candidate, profile };
    }
}

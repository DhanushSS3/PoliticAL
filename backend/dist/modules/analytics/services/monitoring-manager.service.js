"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MonitoringManagerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringManagerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const client_1 = require("@prisma/client");
const keyword_manager_service_1 = require("../../news/services/keyword-manager.service");
let MonitoringManagerService = MonitoringManagerService_1 = class MonitoringManagerService {
    constructor(prisma, keywordManager) {
        this.prisma = prisma;
        this.keywordManager = keywordManager;
        this.logger = new common_1.Logger(MonitoringManagerService_1.name);
    }
    async activateMonitoring(candidateId, userId) {
        this.logger.log(`Activating monitoring for candidate #${candidateId}`);
        const activated = [];
        const candidate = await this.prisma.candidate.findUnique({
            where: { id: candidateId },
            include: {
                party: true,
            },
        });
        if (!candidate) {
            throw new Error(`Candidate #${candidateId} not found`);
        }
        const profile = await this.prisma.candidateProfile.findUnique({
            where: { candidateId },
        });
        if (!profile) {
            throw new Error(`Candidate #${candidateId} has no profile. Please seed CandidateProfile first.`);
        }
        await this.prisma.candidateProfile.update({
            where: { candidateId },
            data: {
                isSubscribed: true,
                userId,
                monitoringStartedAt: new Date(),
            },
        });
        await this.activateEntity(client_1.EntityType.CANDIDATE, candidateId, "SUBSCRIBED", candidateId, 10);
        activated.push({
            type: "CANDIDATE",
            id: candidateId,
            reason: "SUBSCRIBED",
        });
        const opponents = await this.prisma.candidateProfile.findMany({
            where: {
                primaryGeoUnitId: profile.primaryGeoUnitId,
                candidateId: { not: candidateId },
            },
            include: {
                candidate: true,
            },
        });
        this.logger.debug(`Found ${opponents.length} opponents in constituency`);
        for (const opponent of opponents) {
            await this.activateEntity(client_1.EntityType.CANDIDATE, opponent.candidateId, "OPPONENT", candidateId, 9);
            activated.push({
                type: "CANDIDATE",
                id: opponent.candidateId,
                reason: "OPPONENT",
            });
        }
        await this.activateEntity(client_1.EntityType.PARTY, candidate.partyId, "PARTY_CONTEXT", candidateId, 8);
        activated.push({
            type: "PARTY",
            id: candidate.partyId,
            reason: "PARTY_CONTEXT",
        });
        await this.activateEntity(client_1.EntityType.GEO_UNIT, profile.primaryGeoUnitId, "GEO_CONTEXT", candidateId, 9);
        activated.push({
            type: "GEO_UNIT",
            id: profile.primaryGeoUnitId,
            reason: "GEO_CONTEXT",
        });
        await this.seedKeywordsForActivatedEntities(candidateId, opponents);
        this.logger.log(`✅ Activated monitoring for ${activated.length} entities with priority levels`);
        return {
            activated: activated.length,
            entities: activated,
        };
    }
    async activateGeoMonitoring(geoUnitId) {
        this.logger.log(`Activating monitoring for GeoUnit #${geoUnitId}`);
        const geoUnit = await this.prisma.geoUnit.findUnique({
            where: { id: geoUnitId },
        });
        if (!geoUnit)
            throw new Error(`GeoUnit #${geoUnitId} not found`);
        await this.activateEntity(client_1.EntityType.GEO_UNIT, geoUnitId, "SUBSCRIBED", 0, 9);
        await this.keywordManager.seedKeywordsForEntity(client_1.EntityType.GEO_UNIT, geoUnitId, geoUnit.name);
        this.logger.log(`✅ Activated monitoring for GeoUnit #${geoUnitId}`);
    }
    async deactivateMonitoring(candidateId) {
        this.logger.log(`Deactivating monitoring for candidate #${candidateId}`);
        await this.prisma.candidateProfile.update({
            where: { candidateId },
            data: {
                isSubscribed: false,
                monitoringEndedAt: new Date(),
            },
        });
        await this.prisma.entityMonitoring.updateMany({
            where: { triggeredByCandidateId: candidateId },
            data: { isActive: false },
        });
        this.logger.log(`✅ Deactivated monitoring for candidate #${candidateId}`);
    }
    async getActiveEntities() {
        const monitoring = await this.prisma.entityMonitoring.findMany({
            where: { isActive: true },
            select: {
                entityType: true,
                entityId: true,
            },
        });
        return monitoring;
    }
    async isEntityActive(entityType, entityId) {
        var _a;
        const monitoring = await this.prisma.entityMonitoring.findUnique({
            where: {
                entityType_entityId: {
                    entityType,
                    entityId,
                },
            },
        });
        return (_a = monitoring === null || monitoring === void 0 ? void 0 : monitoring.isActive) !== null && _a !== void 0 ? _a : false;
    }
    async activateEntity(entityType, entityId, reason, triggeredBy, priority = 5) {
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
                priority,
                reason,
                triggeredByCandidateId: triggeredBy,
                updatedAt: new Date(),
            },
        });
    }
    async seedKeywordsForActivatedEntities(candidateId, opponents) {
        const candidate = await this.prisma.candidate.findUnique({
            where: { id: candidateId },
            include: { party: true, profile: true },
        });
        if (!candidate || !candidate.profile)
            return;
        await this.keywordManager.seedKeywordsForEntity(client_1.EntityType.CANDIDATE, candidateId, candidate.fullName);
        for (const opponent of opponents) {
            await this.keywordManager.seedKeywordsForEntity(client_1.EntityType.CANDIDATE, opponent.candidateId, opponent.candidate.fullName);
        }
        await this.keywordManager.seedKeywordsForEntity(client_1.EntityType.PARTY, candidate.partyId, candidate.party.name);
        const geoUnit = await this.prisma.geoUnit.findUnique({
            where: { id: candidate.profile.primaryGeoUnitId },
        });
        if (geoUnit) {
            await this.keywordManager.seedKeywordsForEntity(client_1.EntityType.GEO_UNIT, geoUnit.id, geoUnit.name);
        }
        this.logger.log(`✅ Keywords seeded for activated entities`);
    }
    async createCandidate(fullName, partyId, constituencyId, age, gender) {
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
};
exports.MonitoringManagerService = MonitoringManagerService;
exports.MonitoringManagerService = MonitoringManagerService = MonitoringManagerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        keyword_manager_service_1.KeywordManagerService])
], MonitoringManagerService);
//# sourceMappingURL=monitoring-manager.service.js.map
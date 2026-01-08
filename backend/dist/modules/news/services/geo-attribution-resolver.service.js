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
var GeoAttributionResolverService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoAttributionResolverService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const client_1 = require("@prisma/client");
let GeoAttributionResolverService = GeoAttributionResolverService_1 = class GeoAttributionResolverService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(GeoAttributionResolverService_1.name);
        this.fallbackStateGeoUnitId = null;
        this.initializeFallback();
    }
    async initializeFallback() {
        const state = await this.prisma.geoUnit.findFirst({
            where: { name: "Karnataka", level: "STATE" },
        });
        if (state) {
            this.fallbackStateGeoUnitId = state.id;
            this.logger.log(`Fallback state GeoUnit initialized: Karnataka (ID: ${state.id})`);
        }
        else {
            this.logger.warn('Fallback state GeoUnit not found. Ensure "Karnataka" state is seeded.');
        }
    }
    async resolveGeoUnits(articleId) {
        const results = new Map();
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
        const geoMentions = mentions.filter((m) => m.entityType === client_1.EntityType.GEO_UNIT);
        if (geoMentions.length > 0) {
            geoMentions.forEach((m) => {
                results.set(m.entityId, {
                    geoUnitId: m.entityId,
                    sourceEntityType: client_1.EntityType.GEO_UNIT,
                    sourceEntityId: m.entityId,
                });
            });
            this.logger.debug(`Article #${articleId} has explicit GeoUnit mentions: ${results.size}`);
            return Array.from(results.values());
        }
        const candidateMentions = mentions.filter((m) => m.entityType === client_1.EntityType.CANDIDATE);
        if (candidateMentions.length > 0) {
            for (const mention of candidateMentions) {
                const profile = await this.prisma.candidateProfile.findUnique({
                    where: { candidateId: mention.entityId },
                    select: { primaryGeoUnitId: true },
                });
                if (profile) {
                    results.set(profile.primaryGeoUnitId, {
                        geoUnitId: profile.primaryGeoUnitId,
                        sourceEntityType: client_1.EntityType.CANDIDATE,
                        sourceEntityId: mention.entityId,
                    });
                }
            }
            if (results.size > 0) {
                this.logger.debug(`Article #${articleId} resolved via CANDIDATE mentions: ${results.size}`);
                return Array.from(results.values());
            }
        }
        const partyMentions = mentions.filter((m) => m.entityType === client_1.EntityType.PARTY);
        if (partyMentions.length > 0 && this.fallbackStateGeoUnitId) {
            const party = partyMentions[0];
            results.set(this.fallbackStateGeoUnitId, {
                geoUnitId: this.fallbackStateGeoUnitId,
                sourceEntityType: client_1.EntityType.PARTY,
                sourceEntityId: party.entityId,
            });
            this.logger.debug(`Article #${articleId} resolved via PARTY mention to state level`);
            return Array.from(results.values());
        }
        return this.getFallback();
    }
    getFallback() {
        if (this.fallbackStateGeoUnitId) {
            this.logger.debug(`Using fallback state GeoUnit: ${this.fallbackStateGeoUnitId}`);
            return [
                {
                    geoUnitId: this.fallbackStateGeoUnitId,
                },
            ];
        }
        this.logger.warn("No fallback state GeoUnit available");
        return [];
    }
};
exports.GeoAttributionResolverService = GeoAttributionResolverService;
exports.GeoAttributionResolverService = GeoAttributionResolverService = GeoAttributionResolverService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GeoAttributionResolverService);
//# sourceMappingURL=geo-attribution-resolver.service.js.map
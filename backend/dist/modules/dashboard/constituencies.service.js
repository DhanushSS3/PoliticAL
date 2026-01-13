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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConstituenciesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const cache_service_1 = require("../../common/services/cache.service");
let ConstituenciesService = class ConstituenciesService {
    constructor(prisma, cacheService) {
        this.prisma = prisma;
        this.cacheService = cacheService;
    }
    async getMapData(electionId, metric = 'turnout') {
        const cacheKey = cache_service_1.CacheService.getConstituencyMapKey(electionId);
        const cached = await this.cacheService.get(cacheKey);
        const eId = parseInt(electionId);
        const summaries = await this.prisma.geoElectionSummary.findMany({
            where: {
                electionId: eId,
                geoUnit: { level: 'CONSTITUENCY' }
            },
            select: {
                geoUnitId: true,
                geoUnit: { select: { name: true, code: true } },
                turnoutPercent: true,
                winningParty: true,
                winningMargin: true,
                partyResults: {
                    orderBy: { voteCount: 'desc' },
                    take: 1,
                    select: {
                        party: { select: { colorHex: true, symbol: true } }
                    }
                }
            }
        });
        const result = summaries.map(s => {
            var _a, _b;
            return ({
                constituencyId: s.geoUnitId,
                name: s.geoUnit.name,
                code: s.geoUnit.code,
                turnout: s.turnoutPercent,
                winner: s.winningParty,
                margin: s.winningMargin,
                color: ((_b = (_a = s.partyResults[0]) === null || _a === void 0 ? void 0 : _a.party) === null || _b === void 0 ? void 0 : _b.colorHex) || '#ccc'
            });
        });
        await this.cacheService.set(cacheKey, result, 600);
        return result;
    }
    async getSubscribed(userId) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
            include: {
                access: {
                    include: { geoUnit: true }
                }
            }
        });
        if (!subscription)
            return [];
        return subscription.access.map(a => ({
            id: a.geoUnit.id,
            name: a.geoUnit.name,
            number: a.geoUnit.code
        }));
    }
};
exports.ConstituenciesService = ConstituenciesService;
exports.ConstituenciesService = ConstituenciesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService])
], ConstituenciesService);
//# sourceMappingURL=constituencies.service.js.map
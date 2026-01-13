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
var ConstituenciesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConstituenciesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const cache_service_1 = require("../../common/services/cache.service");
let ConstituenciesService = ConstituenciesService_1 = class ConstituenciesService {
    constructor(prisma, cacheService) {
        this.prisma = prisma;
        this.cacheService = cacheService;
        this.logger = new common_1.Logger(ConstituenciesService_1.name);
    }
    async getMapData(electionId, metric = 'turnout', level = 'CONSTITUENCY') {
        let eId = electionId ? parseInt(electionId) : undefined;
        if (!eId || isNaN(eId)) {
            const latestElection = await this.prisma.election.findFirst({
                orderBy: { year: 'desc' },
            });
            if (latestElection)
                eId = latestElection.id;
            else
                return [];
        }
        const cacheKey = `${cache_service_1.CacheService.getConstituencyMapKey(eId.toString())}:${level}`;
        const cached = await this.cacheService.get(cacheKey);
        const summaries = await this.prisma.geoElectionSummary.findMany({
            where: {
                electionId: eId,
                geoUnit: { level: level }
            },
            select: {
                geoUnitId: true,
                geoUnit: {
                    select: {
                        name: true,
                        code: true,
                        children: { select: { id: true } }
                    }
                },
                totalElectors: true,
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
            var _a, _b, _c;
            return ({
                constituencyId: s.geoUnitId,
                name: s.geoUnit.name,
                code: s.geoUnit.code,
                turnout: s.turnoutPercent,
                electors: s.totalElectors,
                seats: ((_a = s.geoUnit.children) === null || _a === void 0 ? void 0 : _a.length) || 1,
                winner: s.winningParty,
                margin: s.winningMargin,
                color: ((_c = (_b = s.partyResults[0]) === null || _b === void 0 ? void 0 : _b.party) === null || _c === void 0 ? void 0 : _c.colorHex) || null
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
exports.ConstituenciesService = ConstituenciesService = ConstituenciesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService])
], ConstituenciesService);
//# sourceMappingURL=constituencies.service.js.map
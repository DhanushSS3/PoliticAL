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
var DashboardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../common/services/cache.service");
const prisma_service_1 = require("../../prisma/prisma.service");
let DashboardService = DashboardService_1 = class DashboardService {
    constructor(cacheService, prisma) {
        this.cacheService = cacheService;
        this.prisma = prisma;
        this.logger = new common_1.Logger(DashboardService_1.name);
    }
    async getSummary(electionId, stateId) {
        var _a, _b;
        const cacheKey = cache_service_1.CacheService.getDashboardSummaryKey(electionId || 'latest', stateId || 'all');
        const cached = await this.cacheService.get(cacheKey);
        if (cached)
            return cached;
        let targetElectionId = electionId ? parseInt(electionId) : undefined;
        if (!targetElectionId) {
            const latestElection = await this.prisma.election.findFirst({
                orderBy: { year: 'desc' },
            });
            if (latestElection)
                targetElectionId = latestElection.id;
        }
        if (!targetElectionId) {
            return { error: "No election data found" };
        }
        const seatSummary = await this.prisma.electionSeatSummary.findUnique({
            where: { electionId: targetElectionId },
            include: { winningParty: true }
        });
        const aggregations = await this.prisma.geoElectionSummary.aggregate({
            where: { electionId: targetElectionId },
            _sum: {
                totalElectors: true,
                totalVotesCast: true,
            },
            _count: {
                geoUnitId: true
            }
        });
        const totalConstituencies = aggregations._count.geoUnitId;
        const totalElectors = aggregations._sum.totalElectors || 0;
        const totalVotes = aggregations._sum.totalVotesCast || 0;
        const avgTurnout = totalElectors > 0 ? (totalVotes / totalElectors) * 100 : 0;
        const partySeats = await this.prisma.partySeatSummary.findMany({
            where: { electionId: targetElectionId },
            include: { party: true },
            orderBy: { seatsWon: 'desc' },
            take: 2
        });
        const leadingParty = partySeats[0];
        const oppositionParty = partySeats[1];
        const result = {
            totalConstituencies,
            totalElectors,
            avgTurnout: parseFloat(avgTurnout.toFixed(2)),
            leadingPartySeats: (leadingParty === null || leadingParty === void 0 ? void 0 : leadingParty.seatsWon) || 0,
            leadingParty: (_a = leadingParty === null || leadingParty === void 0 ? void 0 : leadingParty.party) === null || _a === void 0 ? void 0 : _a.name,
            oppositionPartySeats: (oppositionParty === null || oppositionParty === void 0 ? void 0 : oppositionParty.seatsWon) || 0,
            oppositionParty: (_b = oppositionParty === null || oppositionParty === void 0 ? void 0 : oppositionParty.party) === null || _b === void 0 ? void 0 : _b.name,
            majority: (seatSummary === null || seatSummary === void 0 ? void 0 : seatSummary.majorityMark) || 0,
            swing: "+0.0%",
        };
        await this.cacheService.set(cacheKey, result, 300);
        return result;
    }
    async getPartyStats(electionId) {
        if (!electionId)
            return [];
        const eId = parseInt(electionId);
        const cacheKey = cache_service_1.CacheService.getPartyStatsKey(electionId);
        const cached = await this.cacheService.get(cacheKey);
        if (cached)
            return cached;
        const partyStats = await this.prisma.partySeatSummary.findMany({
            where: { electionId: eId },
            include: { party: true },
            orderBy: { seatsWon: 'desc' }
        });
        const result = partyStats.map(stat => ({
            partyId: stat.partyId,
            name: stat.party.name,
            code: stat.party.symbol || stat.party.name.substring(0, 3).toUpperCase(),
            seats: stat.seatsWon,
            color: stat.party.colorHex || '#ccc'
        }));
        await this.cacheService.set(cacheKey, result, 300);
        return result;
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = DashboardService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cache_service_1.CacheService,
        prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map
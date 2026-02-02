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
    async resolveElectionId(electionId) {
        let targetElectionId = electionId ? parseInt(electionId) : undefined;
        if (!targetElectionId) {
            const latestElection = await this.prisma.election.findFirst({
                orderBy: { year: 'desc' },
            });
            if (latestElection)
                targetElectionId = latestElection.id;
        }
        return targetElectionId;
    }
    async getSummary(electionId) {
        var _a, _b;
        const targetElectionId = await this.resolveElectionId(electionId);
        if (!targetElectionId) {
            return {
                totalConstituencies: 0,
                totalElectors: 0,
                avgTurnout: 0,
                leadingPartySeats: 0,
                leadingParty: "N/A",
                oppositionPartySeats: 0,
                oppositionParty: "N/A",
                majority: 0,
                swing: null
            };
        }
        const cacheKey = cache_service_1.CacheService.getDashboardSummaryKey(targetElectionId.toString(), 'all');
        const cached = await this.cacheService.get(cacheKey);
        if (cached)
            return cached;
        const aggregations = await this.prisma.geoElectionSummary.aggregate({
            where: {
                electionId: targetElectionId,
                geoUnit: { level: 'CONSTITUENCY' }
            },
            _count: { id: true },
            _sum: {
                totalElectors: true,
                totalVotesCast: true
            }
        });
        const seatSummary = await this.prisma.electionSeatSummary.findFirst({
            where: { electionId: targetElectionId }
        });
        const totalConstituencies = aggregations._count.id;
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
        let swing = null;
        try {
            const currentElection = await this.prisma.election.findUnique({
                where: { id: targetElectionId }
            });
            if (currentElection && leadingParty) {
                const previousElection = await this.prisma.election.findFirst({
                    where: {
                        year: { lt: currentElection.year },
                        type: currentElection.type
                    },
                    orderBy: { year: 'desc' }
                });
                if (previousElection) {
                    const currentVoteShare = await this.prisma.partyVoteSummary.aggregate({
                        where: {
                            partyId: leadingParty.partyId,
                            summary: {
                                electionId: targetElectionId,
                                geoUnit: { level: 'CONSTITUENCY' }
                            }
                        },
                        _avg: { voteSharePercent: true }
                    });
                    const previousVoteShare = await this.prisma.partyVoteSummary.aggregate({
                        where: {
                            partyId: leadingParty.partyId,
                            summary: {
                                electionId: previousElection.id,
                                geoUnit: { level: 'CONSTITUENCY' }
                            }
                        },
                        _avg: { voteSharePercent: true }
                    });
                    const currentShare = currentVoteShare._avg.voteSharePercent || 0;
                    const previousShare = previousVoteShare._avg.voteSharePercent || 0;
                    const diff = currentShare - previousShare;
                    const sign = diff > 0 ? "+" : "";
                    swing = `${sign}${diff.toFixed(2)}% Vote Share`;
                }
            }
        }
        catch (e) {
            this.logger.error('Error calculating swing:', e);
        }
        const result = {
            totalConstituencies,
            totalElectors,
            avgTurnout: parseFloat(avgTurnout.toFixed(2)),
            leadingPartySeats: (leadingParty === null || leadingParty === void 0 ? void 0 : leadingParty.seatsWon) || 0,
            leadingParty: (_a = leadingParty === null || leadingParty === void 0 ? void 0 : leadingParty.party) === null || _a === void 0 ? void 0 : _a.name,
            oppositionPartySeats: (oppositionParty === null || oppositionParty === void 0 ? void 0 : oppositionParty.seatsWon) || 0,
            oppositionParty: (_b = oppositionParty === null || oppositionParty === void 0 ? void 0 : oppositionParty.party) === null || _b === void 0 ? void 0 : _b.name,
            majority: (seatSummary === null || seatSummary === void 0 ? void 0 : seatSummary.majorityMark) || 0,
            swing: swing,
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
        const result = await Promise.all(partyStats.map(async (stat) => {
            const voteData = await this.prisma.partyVoteSummary.aggregate({
                where: {
                    partyId: stat.partyId,
                    summary: {
                        electionId: eId,
                        geoUnit: { level: 'CONSTITUENCY' }
                    }
                },
                _sum: {
                    voteCount: true
                },
                _avg: {
                    voteSharePercent: true
                }
            });
            return {
                partyId: stat.partyId,
                name: stat.party.name,
                code: stat.party.symbol || stat.party.name.substring(0, 3).toUpperCase(),
                seats: stat.seatsWon,
                votes: voteData._sum.voteCount || 0,
                voteSharePercent: parseFloat((voteData._avg.voteSharePercent || 0).toFixed(2)),
                color: stat.party.colorHex || '#ccc'
            };
        }));
        await this.cacheService.set(cacheKey, result, 300);
        return result;
    }
    async getHistoricalStats() {
        const cacheKey = 'dashboard:historical-stats';
        const cached = await this.cacheService.get(cacheKey);
        if (cached)
            return cached;
        const elections = await this.prisma.election.findMany({
            orderBy: { year: 'asc' },
            include: {
                seatSummaries: {
                    include: { party: true }
                }
            }
        });
        const partyColors = {};
        const stats = elections.map(e => {
            const entry = { year: e.year.toString() };
            e.seatSummaries.forEach(s => {
                const partyName = s.party.name;
                entry[partyName] = s.seatsWon;
                if (!partyColors[partyName]) {
                    partyColors[partyName] = s.party.colorHex || '#ccc';
                }
            });
            return entry;
        });
        const result = {
            stats,
            colors: partyColors
        };
        await this.cacheService.set(cacheKey, result, 3600);
        return result;
    }
    async getReligionDistribution(geoUnitId, year) {
        if (!geoUnitId) {
            return [];
        }
        let targetYear = year;
        if (!targetYear) {
            const latest = await this.prisma.geoReligionStat.findFirst({
                where: { geoUnitId },
                orderBy: { year: 'desc' },
            });
            if (!latest) {
                return [];
            }
            targetYear = latest.year;
        }
        const cacheKey = `dashboard:religion:${geoUnitId}:${targetYear}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached)
            return cached;
        const stats = await this.prisma.geoReligionStat.findMany({
            where: {
                geoUnitId,
                year: targetYear,
            },
            orderBy: { religion: 'asc' },
        });
        if (!stats || stats.length === 0) {
            return [];
        }
        const totalPopulation = stats.reduce((sum, s) => sum + (s.population || 0), 0);
        const result = stats.map((s) => {
            const percent = s.percent != null
                ? parseFloat(s.percent.toFixed(2))
                : totalPopulation > 0
                    ? parseFloat(((s.population / totalPopulation) * 100).toFixed(2))
                    : 0;
            return {
                religion: s.religion,
                population: s.population,
                percent,
                year: s.year,
            };
        });
        await this.cacheService.set(cacheKey, result, 600);
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
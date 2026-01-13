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
        if (level === 'DISTRICT') {
            const constituencies = await this.prisma.geoElectionSummary.findMany({
                where: {
                    electionId: eId,
                    geoUnit: { level: 'CONSTITUENCY' }
                },
                select: {
                    geoUnit: {
                        select: { parentId: true, parent: { select: { id: true, name: true, code: true } } }
                    },
                    winningParty: true,
                    partyResults: {
                        orderBy: { voteCount: 'desc' },
                        take: 1,
                        select: { party: { select: { colorHex: true } } }
                    },
                    totalElectors: true,
                    totalVotesCast: true
                }
            });
            const districtMap = new Map();
            constituencies.forEach(c => {
                var _a, _b;
                const districtId = c.geoUnit.parentId;
                if (!districtId)
                    return;
                if (!districtMap.has(districtId)) {
                    districtMap.set(districtId, {
                        id: districtId,
                        name: c.geoUnit.parent.name,
                        code: c.geoUnit.parent.code,
                        electors: 0,
                        votes: 0,
                        seats: 0,
                        partyCounts: {}
                    });
                }
                const d = districtMap.get(districtId);
                d.electors += c.totalElectors;
                d.votes += c.totalVotesCast;
                d.seats += 1;
                const winner = c.winningParty;
                if (winner) {
                    d.partyCounts[winner] = (d.partyCounts[winner] || 0) + 1;
                    if ((_b = (_a = c.partyResults[0]) === null || _a === void 0 ? void 0 : _a.party) === null || _b === void 0 ? void 0 : _b.colorHex) {
                        d.partyColorMap = d.partyColorMap || {};
                        d.partyColorMap[winner] = c.partyResults[0].party.colorHex;
                    }
                }
            });
            return Array.from(districtMap.values()).map(d => {
                var _a;
                let maxSeats = 0;
                let winner = null;
                Object.entries(d.partyCounts).forEach(([party, seats]) => {
                    if (seats > maxSeats) {
                        maxSeats = seats;
                        winner = party;
                    }
                });
                return {
                    constituencyId: d.id,
                    name: d.name,
                    code: d.code,
                    turnout: d.electors > 0 ? parseFloat(((d.votes / d.electors) * 100).toFixed(2)) : 0,
                    electors: d.electors,
                    seats: d.seats,
                    winner: winner,
                    margin: 0,
                    color: winner ? (((_a = d.partyColorMap) === null || _a === void 0 ? void 0 : _a[winner]) || null) : null
                };
            });
        }
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
    async getDistrictDetails(districtName, electionId) {
        let eId = electionId ? parseInt(electionId) : undefined;
        if (!eId || isNaN(eId)) {
            const latest = await this.prisma.election.findFirst({ orderBy: { year: 'desc' } });
            eId = latest === null || latest === void 0 ? void 0 : latest.id;
        }
        if (!eId)
            return { constituencies: [] };
        const summaries = await this.prisma.geoElectionSummary.findMany({
            where: {
                electionId: eId,
                geoUnit: {
                    level: 'CONSTITUENCY',
                    parent: {
                        OR: [
                            { name: districtName },
                            { name: { contains: districtName } },
                            { name: districtName === 'Davanagere' ? 'Davangere' : districtName },
                            { name: districtName === 'Davangere' ? 'Davanagere' : districtName },
                            { name: districtName === 'Vijayanagara' ? 'Vijayanagar' : districtName },
                            { name: districtName === 'Vijayanagar' ? 'Vijayanagara' : districtName },
                            { name: districtName === 'Chikkamagaluru' ? 'Chikmagalur' : districtName },
                            { name: districtName === 'Chikmagalur' ? 'Chikkamagaluru' : districtName },
                            { name: districtName === 'Shivamogga' ? 'Shimoga' : districtName },
                            { name: districtName === 'Shimoga' ? 'Shivamogga' : districtName },
                            { name: districtName === 'Kalaburagi' ? 'Gulbarga' : districtName },
                            { name: districtName === 'Gulbarga' ? 'Kalaburagi' : districtName },
                            { name: districtName === 'Belagavi' ? 'Belgaum' : districtName },
                            { name: districtName === 'Belgaum' ? 'Belagavi' : districtName },
                            { name: districtName === 'Mysuru' ? 'Mysore' : districtName },
                            { name: districtName === 'Mysore' ? 'Mysuru' : districtName },
                            { name: districtName === 'Bengaluru Urban' ? 'Bangalore Urban' : districtName },
                            { name: districtName === 'Bangalore Urban' ? 'Bengaluru Urban' : districtName }
                        ]
                    }
                }
            },
            select: {
                geoUnit: { select: { name: true } },
                winningCandidate: true,
                winningParty: true,
                winningMargin: true,
                winningMarginPct: true,
            }
        });
        const details = await this.prisma.constituencyMarginSummary.findMany({
            where: {
                electionId: eId,
                geoUnit: {
                    parent: {
                        OR: [
                            { name: districtName },
                            { name: { contains: districtName } },
                            { name: districtName === 'Davanagere' ? 'Davangere' : districtName },
                            { name: districtName === 'Davangere' ? 'Davanagere' : districtName },
                            { name: districtName === 'Vijayanagara' ? 'Vijayanagar' : districtName },
                            { name: districtName === 'Vijayanagar' ? 'Vijayanagara' : districtName },
                            { name: districtName === 'Chikkamagaluru' ? 'Chikmagalur' : districtName },
                            { name: districtName === 'Chikmagalur' ? 'Chikkamagaluru' : districtName },
                            { name: districtName === 'Shivamogga' ? 'Shimoga' : districtName },
                            { name: districtName === 'Shimoga' ? 'Shivamogga' : districtName },
                            { name: districtName === 'Kalaburagi' ? 'Gulbarga' : districtName },
                            { name: districtName === 'Gulbarga' ? 'Kalaburagi' : districtName },
                            { name: districtName === 'Belagavi' ? 'Belgaum' : districtName },
                            { name: districtName === 'Belgaum' ? 'Belagavi' : districtName },
                            { name: districtName === 'Mysuru' ? 'Mysore' : districtName },
                            { name: districtName === 'Mysore' ? 'Mysuru' : districtName },
                            { name: districtName === 'Bengaluru Urban' ? 'Bangalore Urban' : districtName },
                            { name: districtName === 'Bangalore Urban' ? 'Bengaluru Urban' : districtName }
                        ]
                    }
                }
            },
            include: {
                geoUnit: true,
                winningParty: true,
                runnerUpParty: true,
            }
        });
        const winnerMap = new Map();
        summaries.forEach(s => {
            var _a;
            if (((_a = s.geoUnit) === null || _a === void 0 ? void 0 : _a.name) && s.winningCandidate) {
                winnerMap.set(s.geoUnit.name, s.winningCandidate);
            }
        });
        return {
            constituencies: details.map(d => ({
                name: d.geoUnit.name,
                sittingMLA: winnerMap.get(d.geoUnit.name) || "Unknown",
                party: d.winningParty.name,
                margin: parseFloat(d.marginPercent.toFixed(2)),
                defeatedBy: `Candidate from ${d.runnerUpParty.name}`,
            }))
        };
    }
};
exports.ConstituenciesService = ConstituenciesService;
exports.ConstituenciesService = ConstituenciesService = ConstituenciesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService])
], ConstituenciesService);
//# sourceMappingURL=constituencies.service.js.map
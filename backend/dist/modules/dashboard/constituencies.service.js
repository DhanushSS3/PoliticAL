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
        const geoUnitIds = summaries.map(s => s.geoUnitId);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        let controversyMap = new Map();
        if (level && level.toString() === 'DISTRICT') {
            const allConstituencies = await this.prisma.geoUnit.findMany({
                where: {
                    parentId: { in: geoUnitIds },
                    level: 'CONSTITUENCY'
                },
                select: { id: true, parentId: true }
            });
            const constituencyIds = allConstituencies.map(c => c.id);
            const controversyData = await this.prisma.sentimentSignal.groupBy({
                by: ['geoUnitId'],
                where: {
                    geoUnitId: { in: constituencyIds },
                    sentiment: 'NEGATIVE',
                    confidence: { gte: 0.7 },
                    createdAt: { gte: thirtyDaysAgo }
                },
                _count: { id: true }
            });
            const districtControversyMap = new Map();
            controversyData.forEach(c => {
                const constituency = allConstituencies.find(ac => ac.id === c.geoUnitId);
                if (constituency && constituency.parentId) {
                    const current = districtControversyMap.get(constituency.parentId) || 0;
                    districtControversyMap.set(constituency.parentId, current + c._count.id);
                }
            });
            controversyMap = districtControversyMap;
        }
        else {
            const controversyData = await this.prisma.sentimentSignal.groupBy({
                by: ['geoUnitId'],
                where: {
                    geoUnitId: { in: geoUnitIds },
                    sentiment: 'NEGATIVE',
                    confidence: { gte: 0.7 },
                    createdAt: { gte: thirtyDaysAgo }
                },
                _count: { id: true }
            });
            controversyData.forEach(c => {
                controversyMap.set(c.geoUnitId, c._count.id);
            });
        }
        const maxControversy = Math.max(...Array.from(controversyMap.values()), 1);
        const result = summaries.map(s => {
            var _a, _b, _c;
            const seed = s.geoUnitId * 9301 + 49297;
            const youthShare = (seed % 150) / 10 + 20;
            const controversyCount = controversyMap.get(s.geoUnitId) || 0;
            const controversy = maxControversy > 0
                ? parseFloat((controversyCount / maxControversy).toFixed(2))
                : 0;
            return {
                constituencyId: s.geoUnitId,
                name: s.geoUnit.name,
                code: s.geoUnit.code,
                turnout: s.turnoutPercent,
                electors: s.totalElectors,
                seats: ((_a = s.geoUnit.children) === null || _a === void 0 ? void 0 : _a.length) || 1,
                winner: s.winningParty,
                margin: s.winningMargin,
                color: ((_c = (_b = s.partyResults[0]) === null || _b === void 0 ? void 0 : _b.party) === null || _c === void 0 ? void 0 : _c.colorHex) || null,
                youth: parseFloat(youthShare.toFixed(1)),
                controversy: controversy,
                controversyCount: controversyCount
            };
        });
        await this.cacheService.set(cacheKey, result, 600);
        return result;
    }
    async getSubscribed(userId) {
        try {
            this.logger.debug(`Fetching subscribed constituencies for user #${userId}`);
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId },
                include: {
                    access: {
                        include: {
                            geoUnit: {
                                include: {
                                    parent: {
                                        include: {
                                            parent: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            if (!subscription) {
                this.logger.warn(`No subscription found for user #${userId}`);
                return [];
            }
            const constituencies = subscription.access.map(a => {
                const geoUnit = a.geoUnit;
                const district = geoUnit.parent;
                const state = district === null || district === void 0 ? void 0 : district.parent;
                return {
                    id: geoUnit.id,
                    name: geoUnit.name,
                    number: geoUnit.code,
                    level: geoUnit.level,
                    district: district ? {
                        id: district.id,
                        name: district.name,
                        code: district.code
                    } : null,
                    state: state ? {
                        id: state.id,
                        name: state.name,
                        code: state.code
                    } : null
                };
            });
            this.logger.debug(`Found ${constituencies.length} geo units for user #${userId}`);
            return constituencies;
        }
        catch (error) {
            this.logger.error(`Error fetching subscribed constituencies for user #${userId}:`, error);
            throw error;
        }
    }
    async getConstituencyDetails(constituencyId, electionId) {
        let eId = electionId ? parseInt(electionId) : undefined;
        if (!eId || isNaN(eId)) {
            const latest = await this.prisma.election.findFirst({ orderBy: { year: 'desc' } });
            eId = latest === null || latest === void 0 ? void 0 : latest.id;
        }
        if (!eId)
            return null;
        const summary = await this.prisma.constituencyMarginSummary.findFirst({
            where: {
                geoUnitId: constituencyId,
                electionId: eId
            },
            include: {
                geoUnit: true,
                winningParty: true,
                runnerUpParty: true
            }
        });
        const candidates = await this.prisma.electionResultRaw.findMany({
            where: {
                geoUnitId: constituencyId,
                electionId: eId
            },
            include: { candidate: true },
            orderBy: { votesTotal: 'desc' }
        });
        const winner = candidates[0];
        const runnerUp = candidates[1];
        const geoSummary = await this.prisma.geoElectionSummary.findFirst({
            where: {
                electionId: eId,
                geoUnitId: constituencyId
            }
        });
        if (!summary || !geoSummary)
            return null;
        const risks = await this.calculateRisks(constituencyId, eId);
        const opportunities = await this.calculateOpportunities(constituencyId, eId);
        return {
            id: geoSummary.geoUnitId,
            name: summary.geoUnit.name,
            code: summary.geoUnit.code,
            totalElectors: geoSummary.totalElectors,
            turnout: geoSummary.turnoutPercent,
            margin: summary.marginVotes,
            marginPercentage: summary.marginPercent,
            winner: {
                name: (winner === null || winner === void 0 ? void 0 : winner.candidate.fullName) || geoSummary.winningCandidate,
                party: summary.winningParty.name,
                partyColor: summary.winningParty.colorHex,
                votes: (winner === null || winner === void 0 ? void 0 : winner.votesTotal) || summary.winningVotes,
                votePercentage: winner ? parseFloat(((winner.votesTotal / geoSummary.totalVotesCast) * 100).toFixed(2)) : 0
            },
            runnerUp: {
                name: (runnerUp === null || runnerUp === void 0 ? void 0 : runnerUp.candidate.fullName) || "TBD",
                party: summary.runnerUpParty.name,
                partyColor: summary.runnerUpParty.colorHex,
                votes: (runnerUp === null || runnerUp === void 0 ? void 0 : runnerUp.votesTotal) || summary.runnerUpVotes,
                votePercentage: runnerUp ? parseFloat(((runnerUp.votesTotal / geoSummary.totalVotesCast) * 100).toFixed(2)) : 0
            },
            risks,
            opportunities
        };
    }
    async calculateRisks(constituencyId, electionId) {
        const risks = [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sentiments = await this.prisma.sentimentSignal.findMany({
            where: {
                geoUnitId: constituencyId,
                createdAt: { gte: thirtyDaysAgo }
            }
        });
        const negativeSentiments = sentiments.filter(s => s.sentiment === 'NEGATIVE');
        const negativeRatio = sentiments.length > 0 ? negativeSentiments.length / sentiments.length : 0;
        if (negativeRatio > 0.6) {
            risks.push({
                type: 'Anti-Incumbency',
                severity: 'high',
                description: `High negative sentiment (${(negativeRatio * 100).toFixed(0)}%) in recent news coverage suggests strong anti-incumbency.`
            });
        }
        else if (negativeRatio > 0.4) {
            risks.push({
                type: 'Anti-Incumbency',
                severity: 'medium',
                description: `Moderate negative sentiment (${(negativeRatio * 100).toFixed(0)}%) detected in constituency.`
            });
        }
        const highConfidenceNegative = negativeSentiments.filter(s => s.confidence > 0.7);
        if (highConfidenceNegative.length > 5) {
            risks.push({
                type: 'Controversy',
                severity: 'high',
                description: `${highConfidenceNegative.length} high-impact controversies detected in the last 30 days.`
            });
        }
        else if (highConfidenceNegative.length > 2) {
            risks.push({
                type: 'Controversy',
                severity: 'medium',
                description: `${highConfidenceNegative.length} controversies reported recently.`
            });
        }
        const margin = await this.prisma.constituencyMarginSummary.findFirst({
            where: { geoUnitId: constituencyId, electionId }
        });
        if (margin && margin.marginPercent < 5) {
            risks.push({
                type: 'Narrow Margin',
                severity: 'high',
                description: `Previous election won by only ${margin.marginPercent.toFixed(2)}% margin. Seat is highly competitive.`
            });
        }
        else if (margin && margin.marginPercent < 10) {
            risks.push({
                type: 'Narrow Margin',
                severity: 'medium',
                description: `Moderate margin of ${margin.marginPercent.toFixed(2)}% in last election. Requires strong campaign.`
            });
        }
        return risks.length > 0 ? risks : [{
                type: 'Low Risk',
                severity: 'low',
                description: 'No significant risks detected based on current data.'
            }];
    }
    async calculateOpportunities(constituencyId, electionId) {
        const opportunities = [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sentiments = await this.prisma.sentimentSignal.findMany({
            where: {
                geoUnitId: constituencyId,
                createdAt: { gte: thirtyDaysAgo }
            }
        });
        const positiveSentiments = sentiments.filter(s => s.sentiment === 'POSITIVE');
        const positiveRatio = sentiments.length > 0 ? positiveSentiments.length / sentiments.length : 0;
        if (positiveRatio > 0.5) {
            opportunities.push({
                type: 'Positive Momentum',
                impact: 'high',
                description: `Strong positive sentiment (${(positiveRatio * 100).toFixed(0)}%) in recent coverage. Good time to amplify messaging.`
            });
        }
        else if (positiveRatio > 0.3) {
            opportunities.push({
                type: 'Positive Momentum',
                impact: 'medium',
                description: `Moderate positive sentiment (${(positiveRatio * 100).toFixed(0)}%). Build on current goodwill.`
            });
        }
        if (sentiments.length > 20) {
            opportunities.push({
                type: 'High Media Attention',
                impact: 'high',
                description: `${sentiments.length} news articles in last 30 days. High visibility can be leveraged for campaign messaging.`
            });
        }
        const geoSummary = await this.prisma.geoElectionSummary.findFirst({
            where: { geoUnitId: constituencyId, electionId }
        });
        if (geoSummary && geoSummary.turnoutPercent < 70) {
            opportunities.push({
                type: 'Turnout Potential',
                impact: 'medium',
                description: `Previous turnout was ${geoSummary.turnoutPercent.toFixed(1)}%. Mobilizing non-voters could be decisive.`
            });
        }
        return opportunities.length > 0 ? opportunities : [{
                type: 'Stable Base',
                impact: 'low',
                description: 'Focus on maintaining current support levels.'
            }];
    }
    async getOpponents(constituencyId) {
        try {
            this.logger.debug(`Fetching opponents for constituency #${constituencyId}`);
            const latestElection = await this.prisma.electionResultRaw.findFirst({
                where: { geoUnitId: constituencyId },
                orderBy: { election: { year: 'desc' } },
                select: { electionId: true }
            });
            if (!latestElection) {
                this.logger.warn(`No election results found for constituency #${constituencyId}`);
                return [];
            }
            const candidates = await this.prisma.electionResultRaw.findMany({
                where: {
                    geoUnitId: constituencyId,
                    electionId: latestElection.electionId
                },
                include: {
                    candidate: true,
                    party: true
                },
                orderBy: { votesTotal: 'desc' }
            });
            const opponents = candidates.map(c => ({
                id: c.candidateId,
                name: c.candidate.fullName,
                party: c.party.name,
                partyColor: c.party.colorHex,
                votes: c.votesTotal,
                age: c.candidate.age,
                gender: c.candidate.gender
            }));
            this.logger.debug(`Found ${opponents.length} opponents for constituency #${constituencyId}`);
            return opponents;
        }
        catch (error) {
            this.logger.error(`Error fetching opponents for constituency #${constituencyId}:`, error);
            throw error;
        }
    }
    async getDistrictDetails(districtName, electionId) {
        try {
            this.logger.debug(`Fetching district details for ${districtName}`);
            let eId = electionId ? parseInt(electionId) : undefined;
            if (!eId || isNaN(eId)) {
                const latest = await this.prisma.election.findFirst({ orderBy: { year: 'desc' } });
                eId = latest === null || latest === void 0 ? void 0 : latest.id;
            }
            if (!eId) {
                this.logger.warn('No election found');
                return null;
            }
            const district = await this.prisma.geoUnit.findFirst({
                where: {
                    name: districtName,
                    level: 'DISTRICT'
                }
            });
            if (!district) {
                this.logger.warn(`District ${districtName} not found`);
                return null;
            }
            const constituencies = await this.prisma.geoUnit.findMany({
                where: {
                    parentId: district.id,
                    level: 'CONSTITUENCY'
                }
            });
            const constituencyIds = constituencies.map(c => c.id);
            const summaries = await this.prisma.geoElectionSummary.findMany({
                where: {
                    electionId: eId,
                    geoUnitId: { in: constituencyIds }
                },
                include: {
                    geoUnit: true
                }
            });
            const margins = await this.prisma.constituencyMarginSummary.findMany({
                where: {
                    electionId: eId,
                    geoUnitId: { in: constituencyIds }
                },
                include: {
                    runnerUpParty: true
                }
            });
            const results = await this.prisma.electionResultRaw.findMany({
                where: {
                    electionId: eId,
                    geoUnitId: { in: constituencyIds }
                },
                include: {
                    candidate: true,
                    party: true
                },
                orderBy: { votesTotal: 'desc' }
            });
            const resultsByConstituency = new Map();
            results.forEach(r => {
                if (!resultsByConstituency.has(r.geoUnitId)) {
                    resultsByConstituency.set(r.geoUnitId, []);
                }
                resultsByConstituency.get(r.geoUnitId).push(r);
            });
            const constituencyList = summaries.map(summary => {
                const margin = margins.find(m => m.geoUnitId === summary.geoUnitId);
                const constituencyResults = resultsByConstituency.get(summary.geoUnitId) || [];
                const winner = constituencyResults[0];
                const runnerUp = constituencyResults[1];
                return {
                    name: summary.geoUnit.name,
                    sittingMLA: (winner === null || winner === void 0 ? void 0 : winner.candidate.fullName) || summary.winningCandidate,
                    party: (winner === null || winner === void 0 ? void 0 : winner.party.name) || summary.winningParty,
                    margin: (margin === null || margin === void 0 ? void 0 : margin.marginPercent) || summary.winningMarginPct,
                    defeatedBy: runnerUp
                        ? `${runnerUp.candidate.fullName} (${runnerUp.party.name})`
                        : margin
                            ? `${margin.runnerUpParty.name} Candidate`
                            : 'N/A'
                };
            });
            const partyCounts = {};
            summaries.forEach(s => {
                const party = s.winningParty;
                partyCounts[party] = (partyCounts[party] || 0) + 1;
            });
            this.logger.debug(`Found ${constituencyList.length} constituencies in ${districtName}`);
            return {
                districtId: district.id,
                districtName: district.name,
                totalConstituencies: constituencies.length,
                constituencies: constituencyList,
                partyWiseSeats: partyCounts
            };
        }
        catch (error) {
            this.logger.error(`Error fetching district details for ${districtName}:`, error);
            throw error;
        }
    }
};
exports.ConstituenciesService = ConstituenciesService;
exports.ConstituenciesService = ConstituenciesService = ConstituenciesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService])
], ConstituenciesService);
//# sourceMappingURL=constituencies.service.js.map
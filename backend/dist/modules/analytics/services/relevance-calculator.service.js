"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelevanceCalculatorService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let RelevanceCalculatorService = class RelevanceCalculatorService {
    constructor() {
        this.WEIGHTS = {
            [client_1.EntityType.CANDIDATE]: 1.0,
            [client_1.EntityType.GEO_UNIT]: 0.8,
            [client_1.EntityType.PARTY]: 0.6,
            STATE_FALLBACK: 0.4,
        };
    }
    getBaseWeight(entityType) {
        if (!entityType)
            return this.WEIGHTS.STATE_FALLBACK;
        return this.WEIGHTS[entityType] || this.WEIGHTS.STATE_FALLBACK;
    }
    calculateRelevanceWeight(entityMentions, targetCandidateId, targetPartyId, targetGeoUnitId) {
        if (!entityMentions || entityMentions.length === 0) {
            return this.WEIGHTS.STATE_FALLBACK;
        }
        let maxWeight = this.WEIGHTS.STATE_FALLBACK;
        for (const mention of entityMentions) {
            if (mention.entityType === client_1.EntityType.CANDIDATE &&
                mention.entityId === targetCandidateId) {
                return this.WEIGHTS[client_1.EntityType.CANDIDATE];
            }
            if (mention.entityType === client_1.EntityType.GEO_UNIT &&
                mention.entityId === targetGeoUnitId) {
                maxWeight = Math.max(maxWeight, this.WEIGHTS[client_1.EntityType.GEO_UNIT]);
            }
            if (mention.entityType === client_1.EntityType.PARTY &&
                mention.entityId === targetPartyId) {
                maxWeight = Math.max(maxWeight, this.WEIGHTS[client_1.EntityType.PARTY]);
            }
        }
        return maxWeight;
    }
    getWeightConfig() {
        return Object.assign({}, this.WEIGHTS);
    }
};
exports.RelevanceCalculatorService = RelevanceCalculatorService;
exports.RelevanceCalculatorService = RelevanceCalculatorService = __decorate([
    (0, common_1.Injectable)()
], RelevanceCalculatorService);
//# sourceMappingURL=relevance-calculator.service.js.map
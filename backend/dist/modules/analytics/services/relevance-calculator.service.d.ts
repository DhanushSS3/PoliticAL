import { EntityType } from "@prisma/client";
export declare class RelevanceCalculatorService {
    private readonly WEIGHTS;
    getBaseWeight(entityType: EntityType | null): number;
    calculateRelevanceWeight(entityMentions: Array<{
        entityType: EntityType;
        entityId: number;
    }>, targetCandidateId: number, targetPartyId: number, targetGeoUnitId: number): number;
    getWeightConfig(): {
        CANDIDATE: number;
        GEO_UNIT: number;
        PARTY: number;
        STATE_FALLBACK: number;
    };
}

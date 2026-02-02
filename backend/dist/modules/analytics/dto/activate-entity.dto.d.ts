import { EntityType } from "@prisma/client";
export declare class ActivateEntityDto {
    entityType: EntityType;
    entityId: number;
    priority?: number;
    reason?: string;
    triggeredByCandidateId?: number;
}

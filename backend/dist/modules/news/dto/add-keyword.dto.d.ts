import { EntityType } from '@prisma/client';
export declare class AddKeywordDto {
    entityType: EntityType;
    entityId: number;
    keyword: string;
    priority?: number;
}

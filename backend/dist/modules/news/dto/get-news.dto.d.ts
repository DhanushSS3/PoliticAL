import { EntityType, SentimentLabel } from "@prisma/client";
export declare class GetNewsFeedDto {
    page?: number;
    limit?: number;
    geoUnitId?: number;
    entityId?: number;
    entityType?: EntityType;
    sentiment?: SentimentLabel;
    search?: string;
}

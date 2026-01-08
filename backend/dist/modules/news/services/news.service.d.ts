import { PrismaService } from "../../../prisma/prisma.service";
import { GetNewsFeedDto } from "../dto/get-news.dto";
export declare class NewsService {
    private prisma;
    constructor(prisma: PrismaService);
    getNewsFeed(dto: GetNewsFeedDto): Promise<{
        data: ({
            sentimentSignals: {
                id: number;
                createdAt: Date;
                geoUnitId: number;
                sourceType: import(".prisma/client").$Enums.DataSourceType;
                sourceRefId: number;
                sentiment: import(".prisma/client").$Enums.SentimentLabel;
                sentimentScore: number;
                confidence: number;
                modelVersion: string | null;
                relevanceWeight: number | null;
                sourceEntityType: import(".prisma/client").$Enums.EntityType | null;
                sourceEntityId: number | null;
            }[];
            entityMentions: {
                id: number;
                articleId: number;
                entityType: import(".prisma/client").$Enums.EntityType;
                entityId: number;
            }[];
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            summary: string;
            sourceName: string;
            sourceUrl: string;
            publishedAt: Date;
            status: import(".prisma/client").$Enums.ModerationStatus;
            ingestType: import(".prisma/client").$Enums.NewsIngestType;
            submittedBy: number | null;
            manualInputType: import(".prisma/client").$Enums.ManualInputType | null;
            originalFileUrl: string | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
}

import { PrismaService } from "../../../prisma/prisma.service";
import { EntityType, NewsKeyword } from "@prisma/client";
export declare class KeywordManagerService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    seedKeywordsForEntity(entityType: EntityType, entityId: number, name: string): Promise<void>;
    buildSearchQuery(entityType: EntityType, entityId: number): Promise<string | null>;
    addKeyword(entityType: EntityType, entityId: number, keyword: string, priority?: number): Promise<NewsKeyword>;
    private generateBaseKeywords;
}

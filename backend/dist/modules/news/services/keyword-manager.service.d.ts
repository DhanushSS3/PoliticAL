import { PrismaService } from '../../../prisma/prisma.service';
import { EntityType } from '@prisma/client';
export declare class KeywordManagerService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    seedKeywordsForEntity(entityType: EntityType, entityId: number, name: string): Promise<void>;
    buildSearchQuery(entityType: EntityType, entityId: number): Promise<string | null>;
    private generateBaseKeywords;
}

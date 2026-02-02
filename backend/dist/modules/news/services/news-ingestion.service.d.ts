import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../prisma/prisma.service";
import { KeywordManagerService } from "./keyword-manager.service";
import { SentimentAnalysisService } from "./sentiment-analysis.service";
import { EntityType } from "@prisma/client";
export declare class NewsIngestionService {
    private prisma;
    private keywordManager;
    private sentimentService;
    private configService;
    private readonly logger;
    private readonly parser;
    private readonly GOOGLE_NEWS_BASE_URL;
    private readonly maxArticleAgeHours;
    private readonly timeFilter;
    constructor(prisma: PrismaService, keywordManager: KeywordManagerService, sentimentService: SentimentAnalysisService, configService: ConfigService);
    fetchAllNews(): Promise<void>;
    fetchNewsForEntity(entityType: EntityType, entityId: number, retryCount?: number): any;
    private processFeedItem;
    private getArticleAgeInHours;
    buildEnhancedQuery(entityType: EntityType, entityId: number): Promise<string[]>;
    private getEntityName;
}

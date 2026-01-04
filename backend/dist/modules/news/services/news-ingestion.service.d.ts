import { PrismaService } from '../../../prisma/prisma.service';
import { KeywordManagerService } from './keyword-manager.service';
import { SentimentAnalysisService } from './sentiment-analysis.service';
import { EntityType } from '@prisma/client';
export declare class NewsIngestionService {
    private prisma;
    private keywordManager;
    private sentimentService;
    private readonly logger;
    private readonly parser;
    private readonly GOOGLE_NEWS_BASE_URL;
    constructor(prisma: PrismaService, keywordManager: KeywordManagerService, sentimentService: SentimentAnalysisService);
    fetchAllNews(): Promise<void>;
    fetchNewsForEntity(entityType: EntityType, entityId: number): Promise<void>;
    private processFeedItem;
}

import { NewsIngestionService } from "./services/news-ingestion.service";
import { FileParsingService } from "./services/file-parsing.service";
import { KeywordManagerService } from "./services/keyword-manager.service";
import { SentimentAnalysisService } from "./services/sentiment-analysis.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ManualNewsIngestionDto } from "./dto/manual-ingestion.dto";
import { AddKeywordDto } from "./dto/add-keyword.dto";
export declare class AdminNewsController {
    private readonly newsIngestionService;
    private readonly fileParsingService;
    private readonly sentimentService;
    private readonly keywordManager;
    private readonly prisma;
    constructor(newsIngestionService: NewsIngestionService, fileParsingService: FileParsingService, sentimentService: SentimentAnalysisService, keywordManager: KeywordManagerService, prisma: PrismaService);
    createManualNews(dto: ManualNewsIngestionDto, file: Express.Multer.File): Promise<{
        message: string;
        articleId: number;
    }>;
    addKeyword(dto: AddKeywordDto): Promise<{
        message: string;
        keyword: {
            id: number;
            createdAt: Date;
            isActive: boolean;
            updatedAt: Date;
            priority: number;
            entityType: import(".prisma/client").$Enums.EntityType;
            entityId: number;
            keyword: string;
        };
    }>;
    triggerIngestion(): Promise<{
        message: string;
    }>;
}

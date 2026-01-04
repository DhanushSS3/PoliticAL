import { NewsIngestionService } from './services/news-ingestion.service';
import { FileParsingService } from './services/file-parsing.service';
import { SentimentAnalysisService } from './services/sentiment-analysis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ManualNewsIngestionDto } from './dto/manual-ingestion.dto';
export declare class AdminNewsController {
    private readonly newsIngestionService;
    private readonly fileParsingService;
    private readonly sentimentService;
    private readonly prisma;
    constructor(newsIngestionService: NewsIngestionService, fileParsingService: FileParsingService, sentimentService: SentimentAnalysisService, prisma: PrismaService);
    createManualNews(dto: ManualNewsIngestionDto, file: Express.Multer.File): Promise<{
        message: string;
        articleId: number;
    }>;
    triggerIngestion(): Promise<{
        message: string;
    }>;
}

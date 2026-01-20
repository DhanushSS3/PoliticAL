import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { SentimentAnalysisService } from './sentiment-analysis.service';
import { NewsSource } from '../config/news-sources.config';
export declare class RssFeedIngestionService {
    private prisma;
    private sentimentService;
    private configService;
    private readonly logger;
    private readonly parser;
    private readonly maxArticleAgeHours;
    constructor(prisma: PrismaService, sentimentService: SentimentAnalysisService, configService: ConfigService);
    fetchFromAllSources(): Promise<void>;
    fetchFromSource(source: NewsSource): Promise<void>;
    private processRssItem;
    private getArticleAgeInHours;
    private linkArticleToEntities;
}

import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../../prisma/prisma.service';
import { SentimentAnalysisService } from './sentiment-analysis.service';
import { NewsSource } from '../config/news-sources.config';
export declare class RssFeedIngestionService {
    private prisma;
    private sentimentService;
    private configService;
    private httpService;
    private readonly logger;
    private readonly parser;
    private readonly maxArticleAgeHours;
    private readonly userAgents;
    constructor(prisma: PrismaService, sentimentService: SentimentAnalysisService, configService: ConfigService, httpService: HttpService);
    fetchFromAllSources(): Promise<void>;
    fetchFromSource(source: NewsSource): Promise<void>;
    private processRssItem;
    private getArticleAgeInHours;
    private linkArticleToEntities;
}

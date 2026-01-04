import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
export declare class SentimentAnalysisService {
    private readonly httpService;
    private readonly configService;
    private readonly prisma;
    private readonly logger;
    private readonly analysisServiceUrl;
    constructor(httpService: HttpService, configService: ConfigService, prisma: PrismaService);
    analyzeAndStoreSentiment(articleId: number, content: string, geoUnitId?: number): Promise<void>;
}

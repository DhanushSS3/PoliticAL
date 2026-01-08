import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../prisma/prisma.service";
import { GeoAttributionResolverService } from "./geo-attribution-resolver.service";
import { RelevanceCalculatorService } from "../../analytics/services/relevance-calculator.service";
export declare class SentimentAnalysisService {
    private readonly httpService;
    private readonly configService;
    private readonly prisma;
    private readonly geoResolver;
    private readonly relevanceCalculator;
    private readonly logger;
    private readonly analysisServiceUrl;
    constructor(httpService: HttpService, configService: ConfigService, prisma: PrismaService, geoResolver: GeoAttributionResolverService, relevanceCalculator: RelevanceCalculatorService);
    analyzeAndStoreSentiment(articleId: number, content: string, explicitGeoUnitId?: number): Promise<void>;
}

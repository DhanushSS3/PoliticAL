"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SentimentAnalysisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SentimentAnalysisService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../../prisma/prisma.service");
const geo_attribution_resolver_service_1 = require("./geo-attribution-resolver.service");
const relevance_calculator_service_1 = require("../../analytics/services/relevance-calculator.service");
const rxjs_1 = require("rxjs");
const client_1 = require("@prisma/client");
let SentimentAnalysisService = SentimentAnalysisService_1 = class SentimentAnalysisService {
    constructor(httpService, configService, prisma, geoResolver, relevanceCalculator) {
        this.httpService = httpService;
        this.configService = configService;
        this.prisma = prisma;
        this.geoResolver = geoResolver;
        this.relevanceCalculator = relevanceCalculator;
        this.logger = new common_1.Logger(SentimentAnalysisService_1.name);
        this.analysisServiceUrl =
            this.configService.get("ANALYSIS_SERVICE_URL") ||
                "http://localhost:8000";
    }
    async analyzeAndStoreSentiment(articleId, content, explicitGeoUnitId) {
        try {
            this.logger.debug(`Requesting sentiment analysis for article #${articleId}`);
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.analysisServiceUrl}/analyze/sentiment`, {
                content,
                language: "auto",
                context: "political_news",
            }));
            this.logger.debug(`Received sentiment: ${data.label} (${data.score})`);
            let resolutions = [];
            if (explicitGeoUnitId) {
                resolutions.push({
                    geoUnitId: explicitGeoUnitId,
                });
                this.logger.debug(`Using explicit geoUnitId: ${explicitGeoUnitId}`);
            }
            else {
                resolutions = await this.geoResolver.resolveGeoUnits(articleId);
            }
            if (resolutions.length === 0) {
                this.logger.warn(`Could not resolve any GeoUnit for article #${articleId}. Sentiment will not be stored.`);
                return;
            }
            for (const res of resolutions) {
                const relevanceWeight = this.relevanceCalculator.getBaseWeight(res.sourceEntityType || null);
                await this.prisma.sentimentSignal.create({
                    data: {
                        geoUnitId: res.geoUnitId,
                        sourceType: client_1.DataSourceType.NEWS,
                        sourceRefId: articleId,
                        sentiment: data.label,
                        sentimentScore: data.score,
                        confidence: data.confidence,
                        modelVersion: data.model_version,
                        relevanceWeight,
                        sourceEntityType: res.sourceEntityType,
                        sourceEntityId: res.sourceEntityId,
                    },
                });
            }
            this.logger.log(`✅ Sentiment stored for article #${articleId} across ${resolutions.length} GeoUnit(s)`);
        }
        catch (error) {
            this.logger.error(`Sentiment analysis failed for article #${articleId}: ${error.message}`);
        }
    }
};
exports.SentimentAnalysisService = SentimentAnalysisService;
exports.SentimentAnalysisService = SentimentAnalysisService = SentimentAnalysisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService,
        prisma_service_1.PrismaService,
        geo_attribution_resolver_service_1.GeoAttributionResolverService,
        relevance_calculator_service_1.RelevanceCalculatorService])
], SentimentAnalysisService);
//# sourceMappingURL=sentiment-analysis.service.js.map
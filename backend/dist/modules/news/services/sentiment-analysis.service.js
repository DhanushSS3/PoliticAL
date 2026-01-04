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
const rxjs_1 = require("rxjs");
const client_1 = require("@prisma/client");
let SentimentAnalysisService = SentimentAnalysisService_1 = class SentimentAnalysisService {
    constructor(httpService, configService, prisma) {
        this.httpService = httpService;
        this.configService = configService;
        this.prisma = prisma;
        this.logger = new common_1.Logger(SentimentAnalysisService_1.name);
        this.analysisServiceUrl = this.configService.get('ANALYSIS_SERVICE_URL') || 'http://localhost:8000';
    }
    async analyzeAndStoreSentiment(articleId, content, geoUnitId) {
        try {
            this.logger.debug(`Requesting sentiment analysis for article #${articleId}`);
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.analysisServiceUrl}/analyze/sentiment`, {
                content,
                language: 'auto',
                context: 'political_news'
            }));
            this.logger.debug(`Received sentiment: ${data.label} (${data.score})`);
            let targetGeoUnitIds = [];
            if (geoUnitId) {
                targetGeoUnitIds.push(geoUnitId);
            }
            else {
                const links = await this.prisma.newsEntityMention.findMany({
                    where: { articleId, entityType: 'GEO_UNIT' },
                });
                targetGeoUnitIds = links.map(l => l.entityId);
            }
            if (targetGeoUnitIds.length === 0) {
                this.logger.warn(`No GeoUnit linked for article #${articleId}, skipping sentiment storage.`);
                return;
            }
            for (const gid of targetGeoUnitIds) {
                await this.prisma.sentimentSignal.create({
                    data: {
                        geoUnitId: gid,
                        sourceType: client_1.DataSourceType.NEWS,
                        sourceRefId: articleId,
                        sentiment: data.label,
                        sentimentScore: data.score,
                        confidence: data.confidence,
                        modelVersion: data.model_version,
                    },
                });
            }
            this.logger.log(`Sentiment stored for article #${articleId}`);
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
        prisma_service_1.PrismaService])
], SentimentAnalysisService);
//# sourceMappingURL=sentiment-analysis.service.js.map
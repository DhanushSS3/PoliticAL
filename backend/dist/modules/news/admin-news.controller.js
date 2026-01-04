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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminNewsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const news_ingestion_service_1 = require("./services/news-ingestion.service");
const file_parsing_service_1 = require("./services/file-parsing.service");
const sentiment_analysis_service_1 = require("./services/sentiment-analysis.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const roles_guard_1 = require("../auth/guards/roles.guard");
const session_guard_1 = require("../auth/guards/session.guard");
const manual_ingestion_dto_1 = require("./dto/manual-ingestion.dto");
let AdminNewsController = class AdminNewsController {
    constructor(newsIngestionService, fileParsingService, sentimentService, prisma) {
        this.newsIngestionService = newsIngestionService;
        this.fileParsingService = fileParsingService;
        this.sentimentService = sentimentService;
        this.prisma = prisma;
    }
    async createManualNews(dto, file) {
        let content = '';
        let sourceUrl = '';
        let title = dto.title || 'Manual Entry';
        const submittedBy = 1;
        if (dto.inputType === client_1.ManualInputType.FILE) {
            if (!file)
                throw new common_1.BadRequestException('File is required for FILE input type');
            content = await this.fileParsingService.parseFile(file.buffer, file.originalname);
            sourceUrl = `file://${file.originalname}`;
            title = file.originalname;
        }
        else if (dto.inputType === client_1.ManualInputType.LINK) {
            if (!dto.linkUrl)
                throw new common_1.BadRequestException('Link URL is required for LINK input type');
            sourceUrl = dto.linkUrl;
            content = 'Link content needs fetching...';
            if (dto.textContent)
                content = dto.textContent;
        }
        else if (dto.inputType === client_1.ManualInputType.TEXT) {
            if (!dto.textContent)
                throw new common_1.BadRequestException('Text content is required for TEXT input type');
            content = dto.textContent;
            sourceUrl = 'manual://text-entry';
        }
        if (!content) {
            throw new common_1.BadRequestException('No content could be extracted');
        }
        const article = await this.prisma.newsArticle.create({
            data: {
                title,
                summary: content.substring(0, 500),
                sourceName: 'Admin Manual',
                sourceUrl,
                publishedAt: new Date(),
                status: client_1.ModerationStatus.APPROVED,
                ingestType: client_1.NewsIngestType.MANUAL,
                manualInputType: dto.inputType,
                submittedBy,
                originalFileUrl: sourceUrl,
            },
        });
        this.sentimentService.analyzeAndStoreSentiment(article.id, content)
            .catch(err => console.error(`Sentiment failed for manual upload: ${err.message}`));
        return {
            message: 'News ingested successfully',
            articleId: article.id,
        };
    }
    async triggerIngestion() {
        this.newsIngestionService.fetchAllNews().catch(err => {
            console.error('Manual ingestion trigger failed', err);
        });
        return {
            message: 'Google News ingestion triggered in background',
        };
    }
};
exports.AdminNewsController = AdminNewsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [manual_ingestion_dto_1.ManualNewsIngestionDto, Object]),
    __metadata("design:returntype", Promise)
], AdminNewsController.prototype, "createManualNews", null);
__decorate([
    (0, common_1.Post)('ingest-google'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminNewsController.prototype, "triggerIngestion", null);
exports.AdminNewsController = AdminNewsController = __decorate([
    (0, common_1.Controller)('admin/news'),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    __metadata("design:paramtypes", [news_ingestion_service_1.NewsIngestionService,
        file_parsing_service_1.FileParsingService,
        sentiment_analysis_service_1.SentimentAnalysisService,
        prisma_service_1.PrismaService])
], AdminNewsController);
//# sourceMappingURL=admin-news.controller.js.map
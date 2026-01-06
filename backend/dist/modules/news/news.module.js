"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const keyword_manager_service_1 = require("./services/keyword-manager.service");
const news_ingestion_service_1 = require("./services/news-ingestion.service");
const sentiment_analysis_service_1 = require("./services/sentiment-analysis.service");
const file_parsing_service_1 = require("./services/file-parsing.service");
const news_service_1 = require("./services/news.service");
const admin_news_controller_1 = require("./admin-news.controller");
const news_controller_1 = require("./news.controller");
const auth_module_1 = require("../auth/auth.module");
let NewsModule = class NewsModule {
};
exports.NewsModule = NewsModule;
exports.NewsModule = NewsModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, axios_1.HttpModule],
        controllers: [admin_news_controller_1.AdminNewsController, news_controller_1.NewsController],
        providers: [
            keyword_manager_service_1.KeywordManagerService,
            news_ingestion_service_1.NewsIngestionService,
            sentiment_analysis_service_1.SentimentAnalysisService,
            file_parsing_service_1.FileParsingService,
            news_service_1.NewsService,
        ],
        exports: [
            keyword_manager_service_1.KeywordManagerService,
            news_ingestion_service_1.NewsIngestionService,
            sentiment_analysis_service_1.SentimentAnalysisService,
            file_parsing_service_1.FileParsingService,
            news_service_1.NewsService,
        ],
    })
], NewsModule);
//# sourceMappingURL=news.module.js.map
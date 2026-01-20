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
var GoogleNewsWorker_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleNewsWorker = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const queue_config_1 = require("../config/queue.config");
const news_ingestion_service_1 = require("../services/news-ingestion.service");
let GoogleNewsWorker = GoogleNewsWorker_1 = class GoogleNewsWorker extends bullmq_1.WorkerHost {
    constructor(newsIngestion) {
        super();
        this.newsIngestion = newsIngestion;
        this.logger = new common_1.Logger(GoogleNewsWorker_1.name);
    }
    async process(job) {
        const { entityType, entityId, priority } = job.data;
        this.logger.log(`Processing Google News job for ${entityType} #${entityId} (priority: ${priority})`);
        try {
            await this.newsIngestion.fetchNewsForEntity(entityType, entityId);
            this.logger.log(`✅ Completed Google News job for ${entityType} #${entityId}`);
        }
        catch (error) {
            this.logger.error(`❌ Failed Google News job for ${entityType} #${entityId}: ${error.message}`);
            throw error;
        }
    }
    onCompleted(job) {
        this.logger.debug(`Job ${job.id} completed successfully`);
    }
    onFailed(job, error) {
        this.logger.error(`Job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`);
    }
    onActive(job) {
        this.logger.debug(`Job ${job.id} is now active`);
    }
};
exports.GoogleNewsWorker = GoogleNewsWorker;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('completed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], GoogleNewsWorker.prototype, "onCompleted", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job, Error]),
    __metadata("design:returntype", void 0)
], GoogleNewsWorker.prototype, "onFailed", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], GoogleNewsWorker.prototype, "onActive", null);
exports.GoogleNewsWorker = GoogleNewsWorker = GoogleNewsWorker_1 = __decorate([
    (0, bullmq_1.Processor)(queue_config_1.NEWS_QUEUES.GOOGLE_NEWS, {
        concurrency: 3,
        limiter: {
            max: 10,
            duration: 60000,
        },
    }),
    __metadata("design:paramtypes", [news_ingestion_service_1.NewsIngestionService])
], GoogleNewsWorker);
//# sourceMappingURL=google-news.worker.js.map
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
var RssFeedWorker_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RssFeedWorker = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const queue_config_1 = require("../config/queue.config");
const rss_feed_ingestion_service_1 = require("../services/rss-feed-ingestion.service");
let RssFeedWorker = RssFeedWorker_1 = class RssFeedWorker extends bullmq_1.WorkerHost {
    constructor(rssFeedIngestion) {
        super();
        this.rssFeedIngestion = rssFeedIngestion;
        this.logger = new common_1.Logger(RssFeedWorker_1.name);
    }
    async process(job) {
        const { sourceName, priority } = job.data;
        this.logger.log(`Processing RSS feed job${sourceName ? ` for ${sourceName}` : ' (all sources)'} (priority: ${priority})`);
        try {
            if (sourceName) {
                this.logger.warn('Single source fetching not yet implemented, fetching all');
                await this.rssFeedIngestion.fetchFromAllSources();
            }
            else {
                await this.rssFeedIngestion.fetchFromAllSources();
            }
            this.logger.log(`✅ Completed RSS feed job`);
        }
        catch (error) {
            this.logger.error(`❌ Failed RSS feed job: ${error.message}`);
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
exports.RssFeedWorker = RssFeedWorker;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('completed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], RssFeedWorker.prototype, "onCompleted", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job, Error]),
    __metadata("design:returntype", void 0)
], RssFeedWorker.prototype, "onFailed", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('active'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job]),
    __metadata("design:returntype", void 0)
], RssFeedWorker.prototype, "onActive", null);
exports.RssFeedWorker = RssFeedWorker = RssFeedWorker_1 = __decorate([
    (0, bullmq_1.Processor)(queue_config_1.NEWS_QUEUES.RSS_FEEDS, {
        concurrency: 2,
        limiter: {
            max: 5,
            duration: 60000,
        },
    }),
    __metadata("design:paramtypes", [rss_feed_ingestion_service_1.RssFeedIngestionService])
], RssFeedWorker);
//# sourceMappingURL=rss-feed.worker.js.map
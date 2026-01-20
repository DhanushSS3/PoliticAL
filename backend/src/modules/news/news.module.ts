import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { KeywordManagerService } from "./services/keyword-manager.service";
import { NewsIngestionService } from "./services/news-ingestion.service";
import { SentimentAnalysisService } from "./services/sentiment-analysis.service";
import { FileParsingService } from "./services/file-parsing.service";
import { NewsService } from "./services/news.service";
import { GeoAttributionResolverService } from "./services/geo-attribution-resolver.service";
import { RelevanceCalculatorService } from "../analytics/services/relevance-calculator.service";
import { AdminNewsController } from "./admin-news.controller";
import { AdminNewsQueueController } from "./admin-news-queue.controller";
import { NewsController } from "./news.controller";
import { AuthModule } from "../auth/auth.module";
import { NewsIngestionSchedulerService } from "./services/news-ingestion-scheduler.service";
import { RssFeedIngestionService } from "./services/rss-feed-ingestion.service";
import { NewsQueueSchedulerService } from "./services/news-queue-scheduler.service";
import { GoogleNewsWorker } from "./workers/google-news.worker";
import { RssFeedWorker } from "./workers/rss-feed.worker";
import { NEWS_QUEUES } from "./config/queue.config";

@Module({
  imports: [
    AuthModule,
    HttpModule,
    ConfigModule,
    // Register queues (BullMQ is configured globally in AppModule)
    BullModule.registerQueue(
      { name: NEWS_QUEUES.GOOGLE_NEWS },
      { name: NEWS_QUEUES.RSS_FEEDS },
    ),
  ],
  controllers: [AdminNewsController, AdminNewsQueueController, NewsController],
  providers: [
    // Core services
    KeywordManagerService,
    NewsIngestionService,
    SentimentAnalysisService,
    FileParsingService,
    NewsService,
    GeoAttributionResolverService,
    RelevanceCalculatorService,

    // New services
    RssFeedIngestionService,
    NewsQueueSchedulerService,

    // Legacy scheduler (can be deprecated once queue scheduler is stable)
    NewsIngestionSchedulerService,

    // Workers
    GoogleNewsWorker,
    RssFeedWorker,
  ],
  exports: [
    KeywordManagerService,
    NewsIngestionService,
    SentimentAnalysisService,
    FileParsingService,
    NewsService,
    GeoAttributionResolverService,
    RelevanceCalculatorService,
    RssFeedIngestionService,
    NewsQueueSchedulerService,
  ],
})
export class NewsModule { }

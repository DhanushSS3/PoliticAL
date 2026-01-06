import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaService } from '../../prisma/prisma.service';
import { KeywordManagerService } from './services/keyword-manager.service';
import { NewsIngestionService } from './services/news-ingestion.service';
import { SentimentAnalysisService } from './services/sentiment-analysis.service';
import { FileParsingService } from './services/file-parsing.service';
import { NewsService } from './services/news.service';
import { AdminNewsController } from './admin-news.controller';
import { NewsController } from './news.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule, HttpModule],
    controllers: [AdminNewsController, NewsController],
    providers: [
        KeywordManagerService,
        NewsIngestionService,
        SentimentAnalysisService,
        FileParsingService,
        NewsService,
        // PrismaService assumed global
    ],
    exports: [
        KeywordManagerService,
        NewsIngestionService,
        SentimentAnalysisService,
        FileParsingService,
        NewsService,
    ],
})
export class NewsModule { }

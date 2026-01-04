import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KeywordManagerService } from './services/keyword-manager.service';
import { NewsIngestionService } from './services/news-ingestion.service';
import { AdminNewsController } from './admin-news.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [AdminNewsController],
    providers: [
        // PrismaService is global, so strict injection depends on module design. 
        // Assuming standard NestJS patterns where PrismaModule is global.
        KeywordManagerService,
        NewsIngestionService,
    ],
    exports: [
        KeywordManagerService,
        NewsIngestionService,
    ],
})
export class NewsModule { }

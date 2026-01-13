import { Module } from '@nestjs/common';
import { NewsIntelligenceController } from './news-intelligence.controller';
import { NewsIntelligenceService } from './news-intelligence.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';

@Module({
    imports: [PrismaModule, CommonModule],
    controllers: [NewsIntelligenceController],
    providers: [NewsIntelligenceService],
    exports: [NewsIntelligenceService],
})
export class NewsIntelligenceModule { }

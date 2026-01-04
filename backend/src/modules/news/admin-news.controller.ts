import { Controller, Post, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { NewsIngestionService } from './services/news-ingestion.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionGuard } from '../auth/guards/session.guard';

@Controller('admin/news')
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminNewsController {
    constructor(private readonly newsIngestionService: NewsIngestionService) { }

    /**
     * Manually trigger Google News ingestion
     * Useful for testing or on-demand updates
     */
    @Post('ingest-google')
    @HttpCode(HttpStatus.OK)
    async triggerIngestion() {
        // Run in background, don't block response
        this.newsIngestionService.fetchAllNews().catch(err => {
            console.error('Manual ingestion trigger failed', err);
        });

        return {
            message: 'Google News ingestion triggered in background',
        };
    }
}

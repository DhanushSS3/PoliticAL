import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { NewsService } from './services/news.service';
import { GetNewsFeedDto } from './dto/get-news.dto';
import { SessionGuard } from '../auth/guards/session.guard';

@Controller('news')
@UseGuards(SessionGuard)
export class NewsController {
    constructor(private readonly newsService: NewsService) { }

    @Get()
    async getFeed(@Query() dto: GetNewsFeedDto) {
        return this.newsService.getNewsFeed(dto);
    }
}

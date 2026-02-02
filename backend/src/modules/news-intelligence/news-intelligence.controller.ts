import { Controller, Get, Query, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { NewsIntelligenceService } from './news-intelligence.service';
import { SessionGuard } from '../auth/guards/session.guard';

/**
 * News Intelligence Controller
 * 
 * Handles election projections, controversies, and sentiment analysis.
 * All endpoints are protected and filter data based on user subscriptions.
 */
@Controller('v1/news-intelligence')
@UseGuards(SessionGuard)
export class NewsIntelligenceController {
    constructor(private readonly newsIntelligenceService: NewsIntelligenceService) { }

    @Get('projected-winner')
    async getProjectedWinner(
        @Req() req: any,
        @Query('geoUnitId') geoUnitId?: string,
    ) {
        return this.newsIntelligenceService.getProjectedWinner(geoUnitId, req.user.id);
    }

    @Get('controversies')
    async getControversies(
        @Req() req: any,
        @Query('geoUnitId') geoUnitId?: string,
        @Query('days', new ParseIntPipe({ optional: true })) days?: number,
        @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    ) {
        return this.newsIntelligenceService.getControversies(
            geoUnitId,
            days || 7,
            limit || 5,
            req.user.id,
        );
    }

    @Get('head-to-head')
    async getHeadToHead(
        @Req() req: any,
        @Query('candidate1Id', ParseIntPipe) candidate1Id: number,
        @Query('candidate2Id', ParseIntPipe) candidate2Id: number,
        @Query('days', new ParseIntPipe({ optional: true })) days?: number,
    ) {
        return this.newsIntelligenceService.getHeadToHead(
            candidate1Id,
            candidate2Id,
            days || 30,
            req.user.id,
        );
    }

    @Get('news-impact')
    async getNewsImpact(
        @Req() req: any,
        @Query('geoUnitId') geoUnitId?: string,
        @Query('days', new ParseIntPipe({ optional: true })) days?: number,
    ) {
        return this.newsIntelligenceService.getNewsImpact(geoUnitId, days || 7, req.user.id);
    }

    @Get('live-feed')
    async getLiveFeed(
        @Req() req: any,
        @Query('geoUnitId') geoUnitId?: string,
        @Query('partyId', new ParseIntPipe({ optional: true })) partyId?: number,
        @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    ) {
        return this.newsIntelligenceService.getLiveFeed(geoUnitId, partyId, limit || 20, req.user.id);
    }

    @Get('dashboard-sentiment')
    async getDashboardSentiment(
        @Query('days', new ParseIntPipe({ optional: true })) days?: number,
    ) {
        return this.newsIntelligenceService.getDashboardSentiment(days || 7);
    }

    @Get('dashboard-news-impact')
    async getDashboardNewsImpact(
        @Query('days', new ParseIntPipe({ optional: true })) days?: number,
        @Query('partyLimit', new ParseIntPipe({ optional: true })) partyLimit?: number,
    ) {
        return this.newsIntelligenceService.getDashboardNewsImpact(days || 7, partyLimit || 3);
    }
}

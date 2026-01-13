import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { NewsIntelligenceService } from './news-intelligence.service';

@Controller('v1/news-intelligence')
export class NewsIntelligenceController {
    constructor(private readonly newsIntelligenceService: NewsIntelligenceService) { }

    @Get('projected-winner')
    async getProjectedWinner(
        @Query('constituencyId', ParseIntPipe) constituencyId: number,
    ) {
        return this.newsIntelligenceService.getProjectedWinner(constituencyId);
    }

    @Get('controversies')
    async getControversies(
        @Query('constituencyId', ParseIntPipe) constituencyId: number,
        @Query('days', new ParseIntPipe({ optional: true })) days?: number,
        @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    ) {
        return this.newsIntelligenceService.getControversies(
            constituencyId,
            days || 7,
            limit || 5,
        );
    }

    @Get('head-to-head')
    async getHeadToHead(
        @Query('candidate1Id', ParseIntPipe) candidate1Id: number,
        @Query('candidate2Id', ParseIntPipe) candidate2Id: number,
        @Query('days', new ParseIntPipe({ optional: true })) days?: number,
    ) {
        return this.newsIntelligenceService.getHeadToHead(
            candidate1Id,
            candidate2Id,
            days || 30,
        );
    }

    @Get('news-impact')
    async getNewsImpact(
        @Query('geoUnitId', ParseIntPipe) geoUnitId: number,
        @Query('days', new ParseIntPipe({ optional: true })) days?: number,
    ) {
        return this.newsIntelligenceService.getNewsImpact(geoUnitId, days || 7);
    }

    @Get('live-feed')
    async getLiveFeed(
        @Query('geoUnitId', new ParseIntPipe({ optional: true })) geoUnitId?: number,
        @Query('partyId', new ParseIntPipe({ optional: true })) partyId?: number,
        @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    ) {
        return this.newsIntelligenceService.getLiveFeed(geoUnitId, partyId, limit || 20);
    }
}

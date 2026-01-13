import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('v1/dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get('summary')
    async getSummary(
        @Query('electionId') electionId?: string,
        @Query('stateId') stateId?: string,
        @Query('someIntParam', new ParseIntPipe({ optional: true })) someIntParam?: number, // Example of safe integer parsing
    ) {
        return this.dashboardService.getSummary(electionId);
    }

    @Get('party-stats')
    async getPartyStats(@Query('electionId') electionId: string) {
        return this.dashboardService.getPartyStats(electionId);
    }

    @Get('historical-stats')
    async getHistoricalStats() {
        return this.dashboardService.getHistoricalStats();
    }
}

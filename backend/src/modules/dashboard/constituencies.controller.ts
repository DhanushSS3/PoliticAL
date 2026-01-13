import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ConstituenciesService } from './constituencies.service';
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'; // Assuming Auth exists

@Controller('v1/constituencies')
export class ConstituenciesController {
    constructor(private readonly constituenciesService: ConstituenciesService) { }

    @Get('map-data')
    async getMapData(
        @Query('electionId') electionId: string,
        @Query('metric') metric?: string
    ) {
        return this.constituenciesService.getMapData(electionId, metric);
    }

    @Get('subscribed')
    // @UseGuards(JwtAuthGuard) // validation disabled for now until we confirm Auth module path
    async getSubscribed(@Query('userId') userId: string) {
        // In real app, userId comes from Req.user
        return this.constituenciesService.getSubscribed(parseInt(userId));
    }
}

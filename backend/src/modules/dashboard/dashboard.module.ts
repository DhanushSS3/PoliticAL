import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AuthModule } from '../auth/auth.module';
import { GeoAccessGuard } from '../auth/guards/geo-access.guard';

@Module({
    imports: [AuthModule],
    controllers: [DashboardController],
    providers: [DashboardService, GeoAccessGuard],
})
export class DashboardModule { }

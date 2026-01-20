import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "./prisma/prisma.module";
import databaseConfig from "./config/database.config";
import authConfig from "./config/auth.config";
import appConfig from "./config/app.config";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { GeoModule } from "./modules/geo/geo.module";
import { ElectionsModule } from "./modules/elections/elections.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AdminModule } from "./modules/admin/admin.module";
import { EmailModule } from "./modules/email/email.module";
import { NewsModule } from "./modules/news/news.module";
import { CommonModule } from "./common/common.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ConstituenciesModule } from "./modules/dashboard/constituencies.module";
import { NewsIntelligenceModule } from "./modules/news-intelligence/news-intelligence.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, appConfig],
    }),
    ScheduleModule.forRoot(),
    // BullMQ global configuration
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD', ''),
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SubscriptionsModule,
    GeoModule,
    ElectionsModule,
    AnalyticsModule,
    AdminModule,
    EmailModule,
    NewsModule,
    CommonModule,
    DashboardModule,
    ConstituenciesModule,
    NewsIntelligenceModule,
  ],
})
export class AppModule { }

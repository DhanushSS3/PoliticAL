"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const prisma_module_1 = require("./prisma/prisma.module");
const database_config_1 = require("./config/database.config");
const auth_config_1 = require("./config/auth.config");
const app_config_1 = require("./config/app.config");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const subscriptions_module_1 = require("./modules/subscriptions/subscriptions.module");
const geo_module_1 = require("./modules/geo/geo.module");
const elections_module_1 = require("./modules/elections/elections.module");
const analytics_module_1 = require("./modules/analytics/analytics.module");
const admin_module_1 = require("./modules/admin/admin.module");
const email_module_1 = require("./modules/email/email.module");
const news_module_1 = require("./modules/news/news.module");
const common_module_1 = require("./common/common.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const constituencies_module_1 = require("./modules/dashboard/constituencies.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [database_config_1.default, auth_config_1.default, app_config_1.default],
            }),
            schedule_1.ScheduleModule.forRoot(),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            subscriptions_module_1.SubscriptionsModule,
            geo_module_1.GeoModule,
            elections_module_1.ElectionsModule,
            analytics_module_1.AnalyticsModule,
            admin_module_1.AdminModule,
            email_module_1.EmailModule,
            news_module_1.NewsModule,
            common_module_1.CommonModule,
            dashboard_module_1.DashboardModule,
            constituencies_module_1.ConstituenciesModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
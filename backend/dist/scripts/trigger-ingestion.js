"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../app.module");
const news_ingestion_service_1 = require("../modules/news/services/news-ingestion.service");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const ingestionService = app.get(news_ingestion_service_1.NewsIngestionService);
    console.log('Manually triggering ingestion via script...');
    await ingestionService.fetchAllNews();
    console.log('Ingestion script finished.');
    await app.close();
}
bootstrap();
//# sourceMappingURL=trigger-ingestion.js.map
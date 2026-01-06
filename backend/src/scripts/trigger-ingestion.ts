
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { NewsIngestionService } from '../modules/news/services/news-ingestion.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const ingestionService = app.get(NewsIngestionService);

    console.log('Manually triggering ingestion via script...');
    await ingestionService.fetchAllNews();
    console.log('Ingestion script finished.');

    await app.close();
}

bootstrap();

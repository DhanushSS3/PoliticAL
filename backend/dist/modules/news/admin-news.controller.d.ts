import { NewsIngestionService } from './services/news-ingestion.service';
export declare class AdminNewsController {
    private readonly newsIngestionService;
    constructor(newsIngestionService: NewsIngestionService);
    triggerIngestion(): Promise<{
        message: string;
    }>;
}

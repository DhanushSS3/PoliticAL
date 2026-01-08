import { PrismaService } from "../../../prisma/prisma.service";
import { NewsIngestionService } from "./news-ingestion.service";
export declare class NewsIngestionSchedulerService {
    private readonly prisma;
    private readonly newsIngestion;
    private readonly logger;
    constructor(prisma: PrismaService, newsIngestion: NewsIngestionService);
    scheduleTier1(): Promise<void>;
    scheduleTier2(): Promise<void>;
    scheduleTier3(): Promise<void>;
    private runIngestionForTier;
}

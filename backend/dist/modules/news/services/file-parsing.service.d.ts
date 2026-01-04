import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
export declare class FileParsingService {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly analysisServiceUrl;
    constructor(httpService: HttpService, configService: ConfigService);
    parseFile(fileBuffer: Buffer, filename: string): Promise<string>;
}

import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import * as FormData from "form-data";

interface ParseResponse {
  extracted_text: string;
  page_count: number;
  filename: string;
}

@Injectable()
export class FileParsingService {
  private readonly logger = new Logger(FileParsingService.name);
  private readonly analysisServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.analysisServiceUrl =
      this.configService.get<string>("ANALYSIS_SERVICE_URL") ||
      "http://localhost:8000";
  }

  /**
   * Send file to Python service for text extraction
   */
  async parseFile(fileBuffer: Buffer, filename: string): Promise<string> {
    try {
      const formData = new FormData();
      formData.append("file", fileBuffer, filename);

      const { data } = await firstValueFrom(
        this.httpService.post<ParseResponse>(
          `${this.analysisServiceUrl}/parse/file`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
          },
        ),
      );

      return data.extracted_text;
    } catch (error) {
      this.logger.error(
        `File parsing failed for ${filename}: ${error.message}`,
      );
      throw new Error(`Failed to extract text from file: ${error.message}`);
    }
  }
}

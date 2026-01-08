import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { NewsIngestionService } from "./services/news-ingestion.service";
import { FileParsingService } from "./services/file-parsing.service";
import { KeywordManagerService } from "./services/keyword-manager.service";
import { SentimentAnalysisService } from "./services/sentiment-analysis.service";
import { PrismaService } from "../../prisma/prisma.service";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  UserRole,
  NewsIngestType,
  ModerationStatus,
  ManualInputType,
} from "@prisma/client";
import { RolesGuard } from "../auth/guards/roles.guard";
import { SessionGuard } from "../auth/guards/session.guard";
import { ManualNewsIngestionDto } from "./dto/manual-ingestion.dto";
import { AddKeywordDto } from "./dto/add-keyword.dto";

@Controller("admin/news")
@UseGuards(SessionGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminNewsController {
  constructor(
    private readonly newsIngestionService: NewsIngestionService,
    private readonly fileParsingService: FileParsingService,
    private readonly sentimentService: SentimentAnalysisService,
    private readonly keywordManager: KeywordManagerService,
    private readonly prisma: PrismaService,
  ) { }

  /**
   * Manual News Ingestion (Admin)
   * Supports TEXT, LINK, and FILE
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file"))
  async createManualNews(
    @Body() dto: ManualNewsIngestionDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    let content = "";
    let sourceUrl = "";
    let title = dto.title || "Manual Entry";
    const submittedBy = 1; // TODO: Get actual admin ID from request (req.user.id)

    // 1. Handle Input Types
    if (dto.inputType === ManualInputType.FILE) {
      if (!file)
        throw new BadRequestException("File is required for FILE input type");

      // Parse file
      content = await this.fileParsingService.parseFile(
        file.buffer,
        file.originalname,
      );
      sourceUrl = `file://${file.originalname}`;
      title = file.originalname;
    } else if (dto.inputType === ManualInputType.LINK) {
      if (!dto.linkUrl)
        throw new BadRequestException(
          "Link URL is required for LINK input type",
        );
      sourceUrl = dto.linkUrl;
      content = "Link content needs fetching...";
      if (dto.textContent) content = dto.textContent;
    } else if (dto.inputType === ManualInputType.TEXT) {
      if (!dto.textContent)
        throw new BadRequestException(
          "Text content is required for TEXT input type",
        );
      content = dto.textContent;
      sourceUrl = "manual://text-entry";
    }

    if (!content) {
      throw new BadRequestException("No content could be extracted");
    }

    // 2. Create NewsArticle
    const article = await this.prisma.newsArticle.create({
      data: {
        title,
        summary: content.substring(0, 500),
        sourceName: "Admin Manual",
        sourceUrl,
        publishedAt: new Date(),
        status: ModerationStatus.APPROVED, // Admin uploads are auto-approved
        ingestType: NewsIngestType.MANUAL,
        manualInputType: dto.inputType,
        submittedBy,
        originalFileUrl: sourceUrl,
      },
    });

    // 3. Trigger Sentiment Analysis
    this.sentimentService
      .analyzeAndStoreSentiment(article.id, content)
      .catch((err) =>
        console.error(`Sentiment failed for manual upload: ${err.message}`),
      );

    return {
      message: "News ingested successfully",
      articleId: article.id,
    };
  }


  /**
   * Add a keyword manually
   */
  @Post("keywords")
  @HttpCode(HttpStatus.OK)
  async addKeyword(@Body() dto: AddKeywordDto) {
    const result = await this.keywordManager.addKeyword(
      dto.entityType,
      dto.entityId,
      dto.keyword,
      dto.priority || 5
    );

    return {
      message: "Keyword added successfully",
      keyword: result,
    };
  }

  /**
   * Manually trigger Google News ingestion
   * Useful for testing or on-demand updates
   */
  @Post("ingest-google")
  @HttpCode(HttpStatus.OK)
  async triggerIngestion() {
    // Run in background, don't block response
    this.newsIngestionService.fetchAllNews().catch((err) => {
      console.error("Manual ingestion trigger failed", err);
    });

    return {
      message: "Google News ingestion triggered in background",
    };
  }
}

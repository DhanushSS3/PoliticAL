import { IsOptional, IsInt, IsString, IsEnum, Min } from "class-validator";
import { Type } from "class-transformer";
import { EntityType, SentimentLabel } from "@prisma/client";

export class GetNewsFeedDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  geoUnitId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  entityId?: number;

  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @IsOptional()
  @IsEnum(SentimentLabel)
  sentiment?: SentimentLabel;

  @IsOptional()
  @IsString()
  search?: string;
}

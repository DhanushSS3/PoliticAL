import { EntityType } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ActivateEntityDto {
  @IsEnum(EntityType)
  entityType: EntityType;

  @IsInt()
  entityId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsInt()
  triggeredByCandidateId?: number;
}

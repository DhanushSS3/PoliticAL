import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, Max } from 'class-validator';
import { EntityType } from '@prisma/client';

export class AddKeywordDto {
    @IsEnum(EntityType)
    entityType: EntityType;

    @IsInt()
    entityId: number;

    @IsString()
    @IsNotEmpty()
    keyword: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(10)
    priority?: number;
}

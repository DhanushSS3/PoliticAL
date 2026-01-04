import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { ManualInputType } from '@prisma/client';

export class ManualNewsIngestionDto {
    @IsEnum(ManualInputType)
    inputType: ManualInputType;

    @IsOptional()
    @IsString()
    textContent?: string;

    @IsOptional()
    @IsUrl()
    linkUrl?: string;

    @IsOptional()
    @IsString()
    title?: string = 'Manual Entry'; // Default title if not provided
}

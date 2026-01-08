import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetPulseDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(90)
    @Type(() => Number)
    days?: number = 7;
}

export class GetTrendDto {
    @IsOptional()
    @IsInt()
    @Min(7)
    @Max(365)
    @Type(() => Number)
    days?: number = 30;
}

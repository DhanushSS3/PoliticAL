import { IsInt, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateCandidateDto {
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @IsInt()
    partyId: number;

    @IsInt()
    constituencyId: number; // Primary GeoUnit ID

    @IsOptional()
    @IsInt()
    age?: number;

    @IsOptional()
    @IsString()
    gender?: string;
}

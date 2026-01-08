import { PrismaService } from "../../../prisma/prisma.service";
import { RelevanceCalculatorService } from "./relevance-calculator.service";
import { PulseData, TrendData } from "../interfaces/pulse-data.interface";
export { PulseData, TrendData };
export declare class CandidatePulseService {
    private readonly prisma;
    private readonly relevanceCalculator;
    private readonly logger;
    constructor(prisma: PrismaService, relevanceCalculator: RelevanceCalculatorService);
    calculatePulse(candidateId: number, days?: number): Promise<PulseData>;
    private calculateTrend;
    getPulseTrend(candidateId: number, days?: number): Promise<Array<{
        date: string;
        pulseScore: number;
    }>>;
}

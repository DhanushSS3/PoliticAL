import { PrismaService } from "../../../prisma/prisma.service";
import { CandidatePulseService } from "./candidate-pulse.service";
export declare class AlertService {
    private readonly prisma;
    private readonly pulseService;
    private readonly logger;
    private readonly SPIKE_THRESHOLD;
    private readonly SPIKE_MIN_SIGNALS;
    private readonly SURGE_MIN_COUNT;
    private readonly SURGE_MIN_CONFIDENCE;
    private readonly HIT_SCORE_THRESHOLD;
    private readonly HIT_CONFIDENCE_THRESHOLD;
    constructor(prisma: PrismaService, pulseService: CandidatePulseService);
    detectAlerts(): Promise<void>;
    private checkCandidateAlerts;
    private checkSentimentSpike;
    private checkNegativeSurge;
    private checkHighConfidenceHits;
    private createAlert;
    triggerAlertDetection(): Promise<void>;
}

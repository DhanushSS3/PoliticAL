import { MonitoringManagerService } from "../services/monitoring-manager.service";
import { CreateCandidateDto } from "../dto/create-candidate.dto";
export declare class SubscriptionController {
    private readonly monitoringManager;
    constructor(monitoringManager: MonitoringManagerService);
    activateMonitoring(body: {
        candidateId: number;
        userId?: number;
    }): Promise<{
        activated: number;
        entities: Array<{
            type: string;
            id: number;
            reason: string;
        }>;
        success: boolean;
        message: string;
    }>;
    deactivateMonitoring(candidateId: number): Promise<{
        success: boolean;
        message: string;
    }>;
    getActiveEntities(): Promise<{
        total: number;
        entities: {
            entityType: import(".prisma/client").EntityType;
            entityId: number;
        }[];
    }>;
    subscribeToGeoUnit(id: number): Promise<{
        message: string;
    }>;
    createCandidate(dto: CreateCandidateDto): Promise<{
        candidate: {
            id: number;
            fullName: string;
            gender: string | null;
            age: number | null;
            category: string | null;
            partyId: number;
        };
        profile: {
            userId: number | null;
            createdAt: Date;
            updatedAt: Date;
            partyId: number;
            candidateId: number;
            primaryGeoUnitId: number;
            isSelf: boolean;
            importanceWeight: number;
            isSubscribed: boolean;
            subscriptionId: number | null;
            monitoringStartedAt: Date | null;
            monitoringEndedAt: Date | null;
            opponentId: number | null;
        };
        success: boolean;
        message: string;
    }>;
}

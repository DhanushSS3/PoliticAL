import { MonitoringManagerService } from "../services/monitoring-manager.service";
import { CreateCandidateDto } from "../dto/create-candidate.dto";
import { ActivateEntityDto } from "../dto/activate-entity.dto";
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
    activateEntity(dto: ActivateEntityDto): Promise<{
        entityType: import(".prisma/client").$Enums.EntityType;
        entityId: number;
        priority: number;
        reason: string;
        displayName: string;
        success: boolean;
        message: string;
    }>;
    createCandidate(dto: CreateCandidateDto): Promise<{
        candidate: {
            id: number;
            fullName: string;
            partyId: number;
            gender: string | null;
            age: number | null;
            category: string | null;
        };
        profile: {
            userId: number | null;
            createdAt: Date;
            updatedAt: Date;
            candidateId: number;
            primaryGeoUnitId: number;
            partyId: number;
            isSelf: boolean;
            importanceWeight: number;
            isSubscribed: boolean;
            subscriptionId: number | null;
            monitoringStartedAt: Date | null;
            monitoringEndedAt: Date | null;
            profilePhotoPath: string | null;
            profileTextPath: string | null;
            opponentProfilePhotoPath: string | null;
            opponentProfileTextPath: string | null;
            opponentId: number | null;
        };
        success: boolean;
        message: string;
    }>;
}

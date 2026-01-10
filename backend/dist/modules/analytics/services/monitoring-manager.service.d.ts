import { PrismaService } from "../../../prisma/prisma.service";
import { EntityType } from "@prisma/client";
import { KeywordManagerService } from "../../news/services/keyword-manager.service";
export declare class MonitoringManagerService {
    private readonly prisma;
    private readonly keywordManager;
    private readonly logger;
    constructor(prisma: PrismaService, keywordManager: KeywordManagerService);
    activateMonitoring(candidateId: number, userId?: number): Promise<{
        activated: number;
        entities: Array<{
            type: string;
            id: number;
            reason: string;
        }>;
    }>;
    activateGeoMonitoring(geoUnitId: number): Promise<void>;
    deactivateMonitoring(candidateId: number): Promise<void>;
    getActiveEntities(): Promise<Array<{
        entityType: EntityType;
        entityId: number;
    }>>;
    isEntityActive(entityType: EntityType, entityId: number): Promise<boolean>;
    private activateEntity;
    private seedKeywordsForActivatedEntities;
    activateGeoScope(geoUnitId: number): Promise<void>;
    createCandidate(fullName: string, partyId: number, constituencyId: number, age?: number, gender?: string): Promise<{
        candidate: {
            id: number;
            fullName: string;
            gender: string | null;
            age: number | null;
            category: string | null;
            partyId: number;
        };
        profile: {
            createdAt: Date;
            updatedAt: Date;
            userId: number | null;
            partyId: number;
            candidateId: number;
            primaryGeoUnitId: number;
            isSelf: boolean;
            importanceWeight: number;
            isSubscribed: boolean;
            subscriptionId: number | null;
            monitoringStartedAt: Date | null;
            monitoringEndedAt: Date | null;
        };
    }>;
}

import { PrismaService } from "../../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { CreateUserDto } from "../auth/dto";
import { GeoHierarchyService } from "./geo-hierarchy.service";
export declare class UserProvisioningService {
    private prisma;
    private configService;
    private geoHierarchyService;
    constructor(prisma: PrismaService, configService: ConfigService, geoHierarchyService: GeoHierarchyService);
    provisionUser(dto: CreateUserDto, createdByAdminId: number): Promise<{
        subscription: {
            access: ({
                geoUnit: {
                    name: string;
                    id: number;
                    createdAt: Date;
                    code: string | null;
                    level: import(".prisma/client").$Enums.GeoLevel;
                    parentId: number | null;
                };
            } & {
                id: number;
                subscriptionId: number;
                geoUnitId: number;
            })[];
        } & {
            id: number;
            isTrial: boolean;
            userId: number;
            startsAt: Date;
            endsAt: Date | null;
            createdByAdminId: number | null;
        };
    } & {
        id: number;
        fullName: string;
        email: string | null;
        phone: string;
        passwordHash: string;
        role: import(".prisma/client").$Enums.UserRole;
        isActive: boolean;
        isTrial: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    private calculateSubscriptionDates;
    updateGeoAccess(userId: number, geoUnitIds: number[]): Promise<({
        geoUnit: {
            name: string;
            id: number;
            createdAt: Date;
            code: string | null;
            level: import(".prisma/client").$Enums.GeoLevel;
            parentId: number | null;
        };
    } & {
        id: number;
        subscriptionId: number;
        geoUnitId: number;
    })[]>;
    extendSubscription(userId: number, additionalDays: number): Promise<{
        id: number;
        isTrial: boolean;
        userId: number;
        startsAt: Date;
        endsAt: Date | null;
        createdByAdminId: number | null;
    }>;
    convertTrialToPaid(userId: number, durationDays?: number): Promise<{
        id: number;
        isTrial: boolean;
        userId: number;
        startsAt: Date;
        endsAt: Date | null;
        createdByAdminId: number | null;
    }>;
}

import { PrismaService } from "../../prisma/prisma.service";
import { CreateSubscriptionDto, GrantGeoAccessDto } from "./dto";
export declare class AdminService {
    private prisma;
    constructor(prisma: PrismaService);
    createSubscription(userId: number, dto: CreateSubscriptionDto, adminId: number): Promise<{
        id: number;
        isTrial: boolean;
        userId: number;
        startsAt: Date;
        endsAt: Date | null;
        createdByAdminId: number | null;
    }>;
    updateSubscription(userId: number, dto: Partial<CreateSubscriptionDto>): Promise<{
        id: number;
        isTrial: boolean;
        userId: number;
        startsAt: Date;
        endsAt: Date | null;
        createdByAdminId: number | null;
    }>;
    grantGeoAccess(userId: number, dto: GrantGeoAccessDto): Promise<({
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
    getUserGeoAccess(userId: number): Promise<({
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
    listUsers(filters?: {
        role?: string;
        isActive?: boolean;
        isTrial?: boolean;
    }): Promise<{
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
        id: number;
        fullName: string;
        email: string;
        phone: string;
        role: import(".prisma/client").$Enums.UserRole;
        isActive: boolean;
        isTrial: boolean;
        createdAt: Date;
    }[]>;
    getUserDetails(userId: number): Promise<{
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
        id: number;
        fullName: string;
        email: string;
        phone: string;
        role: import(".prisma/client").$Enums.UserRole;
        isActive: boolean;
        isTrial: boolean;
        createdAt: Date;
        updatedAt: Date;
        sessions: {
            id: string;
            createdAt: Date;
            deviceInfo: string;
            ipAddress: string;
            expiresAt: Date;
            lastActivityAt: Date;
        }[];
    }>;
}

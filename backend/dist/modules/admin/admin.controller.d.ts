import { AdminService } from "./admin.service";
import { AuthService } from "../auth/auth.service";
import { ImpersonationService } from "../auth/impersonation.service";
import { EmailService } from "../email/email.service";
import { CreateUserDto, ImpersonateDto } from "../auth/dto";
import { CreateSubscriptionDto, GrantGeoAccessDto, UpdateUserDto } from "./dto";
import { UserProvisioningService } from "./user-provisioning.service";
import { PrismaService } from "../../prisma/prisma.service";
import { Response } from "express";
export declare class AdminController {
    private readonly adminService;
    private readonly authService;
    private readonly impersonationService;
    private readonly emailService;
    private readonly prisma;
    private readonly userProvisioningService;
    constructor(adminService: AdminService, authService: AuthService, impersonationService: ImpersonationService, emailService: EmailService, prisma: PrismaService, userProvisioningService: UserProvisioningService);
    createUser(createUserDto: CreateUserDto, req: any): Promise<{
        message: string;
        user: {
            id: any;
            fullName: any;
            email: any;
            phone: any;
            role: any;
            isTrial: any;
            subscription: {
                id: any;
                isTrial: any;
                startsAt: any;
                endsAt: any;
                geoAccess: any;
            };
        };
        tempPassword: string;
        emailSent: boolean;
    }>;
    private generateTempPassword;
    listUsers(role?: string, isActive?: string, isTrial?: string): Promise<{
        users: {
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
                userId: number;
                isTrial: boolean;
                startsAt: Date;
                endsAt: Date | null;
                createdByAdminId: number | null;
            };
            id: number;
            createdAt: Date;
            fullName: string;
            email: string;
            phone: string;
            role: import(".prisma/client").$Enums.UserRole;
            isActive: boolean;
            isTrial: boolean;
        }[];
        total: number;
    }>;
    getUserDetails(userId: number): Promise<{
        error: string;
        user?: undefined;
    } | {
        user: {
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
                userId: number;
                isTrial: boolean;
                startsAt: Date;
                endsAt: Date | null;
                createdByAdminId: number | null;
            };
            id: number;
            createdAt: Date;
            fullName: string;
            email: string;
            phone: string;
            role: import(".prisma/client").$Enums.UserRole;
            isActive: boolean;
            isTrial: boolean;
            updatedAt: Date;
            sessions: {
                id: string;
                deviceInfo: string;
                ipAddress: string;
                createdAt: Date;
                expiresAt: Date;
                lastActivityAt: Date;
            }[];
        };
        error?: undefined;
    }>;
    updateUser(userId: number, updateUserDto: UpdateUserDto): Promise<{
        message: string;
        user: {
            id: number;
            createdAt: Date;
            fullName: string;
            email: string | null;
            phone: string;
            passwordHash: string;
            role: import(".prisma/client").$Enums.UserRole;
            isActive: boolean;
            isTrial: boolean;
            profilePhoto: string | null;
            updatedAt: Date;
        };
    }>;
    deactivateUser(userId: number): Promise<{
        message: string;
    }>;
    reactivateUser(userId: number): Promise<{
        message: string;
    }>;
    createSubscription(userId: number, createSubscriptionDto: CreateSubscriptionDto, req: any): Promise<{
        message: string;
        subscription: {
            id: number;
            userId: number;
            isTrial: boolean;
            startsAt: Date;
            endsAt: Date | null;
            createdByAdminId: number | null;
        };
    }>;
    updateSubscription(userId: number, updateSubscriptionDto: Partial<CreateSubscriptionDto>): Promise<{
        message: string;
        subscription: {
            id: number;
            userId: number;
            isTrial: boolean;
            startsAt: Date;
            endsAt: Date | null;
            createdByAdminId: number | null;
        };
    }>;
    grantGeoAccess(userId: number, grantGeoAccessDto: GrantGeoAccessDto): Promise<{
        message: string;
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
    }>;
    getUserGeoAccess(userId: number): Promise<{
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
        total: number;
    }>;
    startImpersonation(impersonateDto: ImpersonateDto, req: any, res: Response): Promise<{
        message: string;
        impersonationToken: string;
        targetUser: {
            id: number;
            fullName: string;
            email: string;
            phone: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
        expiresIn: string;
    }>;
    stopImpersonation(req: any, res: Response): Promise<{
        message: string;
    }>;
    getActiveImpersonations(req: any, adminId?: string): Promise<{
        impersonations: ({
            admin: {
                id: number;
                fullName: string;
                email: string;
                phone: string;
            };
            targetUser: {
                id: number;
                fullName: string;
                email: string;
                phone: string;
            };
        } & {
            id: string;
            deviceInfo: string | null;
            ipAddress: string | null;
            createdAt: Date;
            expiresAt: Date;
            reason: string | null;
            endedAt: Date | null;
            endReason: string | null;
            adminId: number;
            targetUserId: number;
        })[];
        total: number;
    }>;
    getImpersonationHistory(req: any, adminId?: string, limit?: string): Promise<{
        history: ({
            admin: {
                id: number;
                fullName: string;
                email: string;
                phone: string;
            };
            targetUser: {
                id: number;
                fullName: string;
                email: string;
                phone: string;
            };
        } & {
            id: string;
            deviceInfo: string | null;
            ipAddress: string | null;
            createdAt: Date;
            expiresAt: Date;
            reason: string | null;
            endedAt: Date | null;
            endReason: string | null;
            adminId: number;
            targetUserId: number;
        })[];
        total: number;
    }>;
}

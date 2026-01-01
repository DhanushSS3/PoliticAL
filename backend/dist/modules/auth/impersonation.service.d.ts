import { PrismaService } from '../../prisma/prisma.service';
import { ImpersonateDto } from './dto';
import { ImpersonationSession } from '@prisma/client';
export declare class ImpersonationService {
    private prisma;
    constructor(prisma: PrismaService);
    private readonly IMPERSONATION_DURATION_HOURS;
    startImpersonation(adminId: number, dto: ImpersonateDto, deviceInfo?: string, ipAddress?: string): Promise<string>;
    stopImpersonation(impersonationToken: string, reason?: string): Promise<void>;
    endAllImpersonationsForAdmin(adminId: number): Promise<void>;
    validateImpersonation(impersonationToken: string): Promise<ImpersonationSession & {
        admin: any;
        targetUser: any;
    } | null>;
    getActiveImpersonations(adminId?: number): Promise<({
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
        createdAt: Date;
        deviceInfo: string | null;
        ipAddress: string | null;
        expiresAt: Date;
        reason: string | null;
        endedAt: Date | null;
        endReason: string | null;
        adminId: number;
        targetUserId: number;
    })[]>;
    getImpersonationHistory(adminId?: number, limit?: number): Promise<({
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
        createdAt: Date;
        deviceInfo: string | null;
        ipAddress: string | null;
        expiresAt: Date;
        reason: string | null;
        endedAt: Date | null;
        endReason: string | null;
        adminId: number;
        targetUserId: number;
    })[]>;
}

import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { LoginDto, CreateSessionDto } from "./dto";
import { User, Session } from "@prisma/client";
import type { JwtPayload } from "jsonwebtoken";
export interface AccessTokenPayload extends JwtPayload {
    sid: string;
    uid: number;
}
export declare class AuthService {
    private prisma;
    private configService;
    private readonly SESSION_DURATION_DAYS;
    private readonly sessionDurationMs;
    private readonly tokenExpirySeconds;
    private readonly jwtSecret;
    constructor(prisma: PrismaService, configService: ConfigService);
    getSessionDurationMs(): number;
    verifyAccessToken(token: string): AccessTokenPayload;
    private createAccessToken;
    hashPassword(password: string): Promise<string>;
    comparePassword(password: string, hash: string): Promise<boolean>;
    findByEmailOrPhone(emailOrPhone: string): Promise<User | null>;
    login(dto: LoginDto, deviceInfo?: string, ipAddress?: string): Promise<{
        user: any;
        accessToken: string;
    }>;
    createSession(dto: CreateSessionDto): Promise<Session>;
    validateSession(sessionId: string, context?: {
        expectedUserId?: number;
        deviceInfo?: string;
        ipAddress?: string;
    }): Promise<User | null>;
    logout(sessionId: string): Promise<void>;
    invalidateAllUserSessions(userId: number): Promise<void>;
    createUserWithPassword(fullName: string, email: string | undefined, phone: string, password: string | undefined, role: "ADMIN" | "SUBSCRIBER", isTrial: boolean): Promise<{
        user: any;
        tempPassword: string;
    }>;
    setUserPassword(userId: number, password: string): Promise<void>;
    private generateTempPassword;
    deactivateUser(userId: number): Promise<void>;
    reactivateUser(userId: number): Promise<void>;
}

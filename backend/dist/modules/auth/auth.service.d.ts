import { PrismaService } from "../../prisma/prisma.service";
import { LoginDto, CreateSessionDto } from "./dto";
import { User, Session } from "@prisma/client";
export declare class AuthService {
    private prisma;
    constructor(prisma: PrismaService);
    private readonly SESSION_DURATION_DAYS;
    hashPassword(password: string): Promise<string>;
    comparePassword(password: string, hash: string): Promise<boolean>;
    findByEmailOrPhone(emailOrPhone: string): Promise<User | null>;
    login(dto: LoginDto, deviceInfo?: string, ipAddress?: string): Promise<{
        user: any;
        sessionToken: string;
    }>;
    createSession(dto: CreateSessionDto): Promise<Session>;
    validateSession(sessionToken: string): Promise<User | null>;
    logout(sessionToken: string): Promise<void>;
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

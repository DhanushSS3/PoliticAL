import { PrismaService } from "../../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
export declare class OtpService {
    private prisma;
    private configService;
    constructor(prisma: PrismaService, configService: ConfigService);
    private readonly OTP_EXPIRY_MINUTES;
    private readonly OTP_MAX_ATTEMPTS;
    private generateOtp;
    createPasswordResetOtp(userId: number): Promise<string>;
    verifyOtp(userId: number, otp: string): Promise<boolean>;
    deleteOtp(userId: number): Promise<void>;
    cleanupExpiredOtps(): Promise<void>;
}

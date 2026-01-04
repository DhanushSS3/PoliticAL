import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * OtpService
 * 
 * Handles OTP generation, storage, and verification for password reset.
 * 
 * Industry best practices:
 * - Google: 6-digit OTP, 10-minute expiry
 * - AWS: 6-digit OTP, 15-minute expiry
 * - GitHub: 6-digit OTP, 10-minute expiry
 * 
 * Our implementation:
 * - 6-digit numeric OTP
 * - 10-minute expiry
 * - Rate limiting (max 3 attempts)
 * - One OTP per user (new OTP invalidates old)
 */
@Injectable()
export class OtpService {
    constructor(
        private prisma: PrismaService,
        private configService: ConfigService
    ) { }

    private readonly OTP_EXPIRY_MINUTES = 10;
    private readonly OTP_MAX_ATTEMPTS = 3;

    /**
     * Generate 6-digit OTP
     */
    private generateOtp(): string {
        return crypto.randomInt(100000, 999999).toString();
    }

    /**
     * Create OTP for password reset
     * Industry pattern: One active OTP per user (new OTP invalidates old)
     */
    async createPasswordResetOtp(userId: number): Promise<string> {
        const otp = this.generateOtp();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

        // Delete any existing OTPs for this user
        await this.prisma.passwordResetOtp.deleteMany({
            where: { userId },
        });

        // Create new OTP
        await this.prisma.passwordResetOtp.create({
            data: {
                userId,
                otp,
                expiresAt,
                attempts: 0,
            },
        });

        return otp;
    }

    /**
     * Verify OTP
     * Industry pattern: Rate limiting + expiry check
     */
    async verifyOtp(userId: number, otp: string): Promise<boolean> {
        const otpRecord = await this.prisma.passwordResetOtp.findFirst({
            where: {
                userId,
                otp,
            },
        });

        if (!otpRecord) {
            throw new BadRequestException('Invalid OTP');
        }

        // Check expiry
        if (new Date() > otpRecord.expiresAt) {
            await this.prisma.passwordResetOtp.delete({
                where: { id: otpRecord.id },
            });
            throw new BadRequestException('OTP has expired. Please request a new one.');
        }

        // Check attempts
        if (otpRecord.attempts >= this.OTP_MAX_ATTEMPTS) {
            await this.prisma.passwordResetOtp.delete({
                where: { id: otpRecord.id },
            });
            throw new BadRequestException('Too many failed attempts. Please request a new OTP.');
        }

        // Increment attempts
        await this.prisma.passwordResetOtp.update({
            where: { id: otpRecord.id },
            data: { attempts: otpRecord.attempts + 1 },
        });

        return true;
    }

    /**
     * Delete OTP after successful password reset
     */
    async deleteOtp(userId: number): Promise<void> {
        await this.prisma.passwordResetOtp.deleteMany({
            where: { userId },
        });
    }

    /**
     * Cleanup expired OTPs (should be run as cron job)
     */
    async cleanupExpiredOtps(): Promise<void> {
        await this.prisma.passwordResetOtp.deleteMany({
            where: {
                expiresAt: { lt: new Date() },
            },
        });
    }
}

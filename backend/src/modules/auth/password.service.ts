import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { EmailService } from '../email/email.service';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto';

/**
 * PasswordService
 * 
 * Handles password management operations.
 * Follows Single Responsibility Principle - only concerned with password operations.
 * 
 * Industry best practices:
 * 1. Change Password: Requires current password (Google, GitHub, AWS)
 * 2. Forgot Password: Email OTP (Google, Microsoft, GitHub)
 * 3. Password Requirements: Minimum 8 characters (industry standard)
 */
@Injectable()
export class PasswordService {
    constructor(
        private prisma: PrismaService,
        private authService: AuthService,
        private otpService: OtpService,
        private emailService: EmailService
    ) { }

    /**
     * Change password (requires current password)
     * Industry pattern: Google, GitHub, AWS all require current password
     */
    async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
        // Get user
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        // Verify current password
        const isCurrentPasswordValid = await this.authService.comparePassword(
            dto.currentPassword,
            user.passwordHash
        );

        if (!isCurrentPasswordValid) {
            throw new UnauthorizedException('Current password is incorrect');
        }

        // Validate new password
        this.validatePassword(dto.newPassword);

        // Check new password is different from current
        const isSamePassword = await this.authService.comparePassword(
            dto.newPassword,
            user.passwordHash
        );

        if (isSamePassword) {
            throw new BadRequestException('New password must be different from current password');
        }

        // Update password
        await this.authService.setUserPassword(userId, dto.newPassword);

        // Invalidate all sessions (force re-login with new password)
        await this.authService.invalidateAllUserSessions(userId);

        // Send email notification
        if (user.email) {
            await this.emailService.sendPasswordChangedEmail(user.email, user.fullName);
        }
    }

    /**
     * Forgot password - Send OTP
     * Industry pattern: Google, Microsoft, GitHub send OTP to email
     */
    async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
        // Find user
        const user = await this.authService.findByEmailOrPhone(dto.emailOrPhone);

        if (!user) {
            // Security: Don't reveal if user exists
            return {
                message: 'If an account exists with this email/phone, you will receive an OTP shortly.',
            };
        }

        if (!user.email) {
            throw new BadRequestException('User does not have an email address. Please contact admin.');
        }

        // Generate OTP
        const otp = await this.otpService.createPasswordResetOtp(user.id);

        // Send OTP via email
        await this.emailService.sendPasswordResetOtp(user.email, user.fullName, otp);

        return {
            message: 'If an account exists with this email/phone, you will receive an OTP shortly.',
        };
    }

    /**
     * Reset password with OTP
     * Industry pattern: Verify OTP + set new password (Google, GitHub)
     */
    async resetPassword(dto: ResetPasswordDto): Promise<void> {
        // Find user
        const user = await this.authService.findByEmailOrPhone(dto.emailOrPhone);

        if (!user) {
            throw new BadRequestException('Invalid credentials');
        }

        // Verify OTP
        await this.otpService.verifyOtp(user.id, dto.otp);

        // Validate new password
        this.validatePassword(dto.newPassword);

        // Update password
        await this.authService.setUserPassword(user.id, dto.newPassword);

        // Delete OTP
        await this.otpService.deleteOtp(user.id);

        // Invalidate all sessions (force re-login)
        await this.authService.invalidateAllUserSessions(user.id);

        // Send confirmation email
        if (user.email) {
            await this.emailService.sendPasswordResetConfirmation(user.email, user.fullName);
        }
    }

    /**
     * Validate password requirements
     * Industry standard: Minimum 8 characters
     */
    private validatePassword(password: string): void {
        if (password.length < 8) {
            throw new BadRequestException('Password must be at least 8 characters long');
        }

        // Optional: Add more requirements
        // - At least one uppercase letter
        // - At least one lowercase letter
        // - At least one number
        // - At least one special character

        // For now, keeping it simple (8 characters minimum)
    }
}

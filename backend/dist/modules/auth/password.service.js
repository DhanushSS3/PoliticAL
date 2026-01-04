"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const auth_service_1 = require("./auth.service");
const otp_service_1 = require("./otp.service");
const email_service_1 = require("../email/email.service");
let PasswordService = class PasswordService {
    constructor(prisma, authService, otpService, emailService) {
        this.prisma = prisma;
        this.authService = authService;
        this.otpService = otpService;
        this.emailService = emailService;
    }
    async changePassword(userId, dto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new common_1.BadRequestException('User not found');
        }
        const isCurrentPasswordValid = await this.authService.comparePassword(dto.currentPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
            throw new common_1.UnauthorizedException('Current password is incorrect');
        }
        this.validatePassword(dto.newPassword);
        const isSamePassword = await this.authService.comparePassword(dto.newPassword, user.passwordHash);
        if (isSamePassword) {
            throw new common_1.BadRequestException('New password must be different from current password');
        }
        await this.authService.setUserPassword(userId, dto.newPassword);
        await this.authService.invalidateAllUserSessions(userId);
        if (user.email) {
            await this.emailService.sendPasswordChangedEmail(user.email, user.fullName);
        }
    }
    async forgotPassword(dto) {
        const user = await this.authService.findByEmailOrPhone(dto.emailOrPhone);
        if (!user) {
            return {
                message: 'If an account exists with this email/phone, you will receive an OTP shortly.',
            };
        }
        if (!user.email) {
            throw new common_1.BadRequestException('User does not have an email address. Please contact admin.');
        }
        const otp = await this.otpService.createPasswordResetOtp(user.id);
        await this.emailService.sendPasswordResetOtp(user.email, user.fullName, otp);
        return {
            message: 'If an account exists with this email/phone, you will receive an OTP shortly.',
        };
    }
    async resetPassword(dto) {
        const user = await this.authService.findByEmailOrPhone(dto.emailOrPhone);
        if (!user) {
            throw new common_1.BadRequestException('Invalid credentials');
        }
        await this.otpService.verifyOtp(user.id, dto.otp);
        this.validatePassword(dto.newPassword);
        await this.authService.setUserPassword(user.id, dto.newPassword);
        await this.otpService.deleteOtp(user.id);
        await this.authService.invalidateAllUserSessions(user.id);
        if (user.email) {
            await this.emailService.sendPasswordResetConfirmation(user.email, user.fullName);
        }
    }
    validatePassword(password) {
        if (password.length < 8) {
            throw new common_1.BadRequestException('Password must be at least 8 characters long');
        }
    }
};
exports.PasswordService = PasswordService;
exports.PasswordService = PasswordService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_service_1.AuthService,
        otp_service_1.OtpService,
        email_service_1.EmailService])
], PasswordService);
//# sourceMappingURL=password.service.js.map
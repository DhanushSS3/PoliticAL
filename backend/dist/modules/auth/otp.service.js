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
exports.OtpService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const config_1 = require("@nestjs/config");
const crypto = require("crypto");
let OtpService = class OtpService {
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
        this.OTP_EXPIRY_MINUTES = 10;
        this.OTP_MAX_ATTEMPTS = 3;
    }
    generateOtp() {
        return crypto.randomInt(100000, 999999).toString();
    }
    async createPasswordResetOtp(userId) {
        const otp = this.generateOtp();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);
        await this.prisma.passwordResetOtp.deleteMany({
            where: { userId },
        });
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
    async verifyOtp(userId, otp) {
        const otpRecord = await this.prisma.passwordResetOtp.findFirst({
            where: {
                userId,
                otp,
            },
        });
        if (!otpRecord) {
            throw new common_1.BadRequestException("Invalid OTP");
        }
        if (new Date() > otpRecord.expiresAt) {
            await this.prisma.passwordResetOtp.delete({
                where: { id: otpRecord.id },
            });
            throw new common_1.BadRequestException("OTP has expired. Please request a new one.");
        }
        if (otpRecord.attempts >= this.OTP_MAX_ATTEMPTS) {
            await this.prisma.passwordResetOtp.delete({
                where: { id: otpRecord.id },
            });
            throw new common_1.BadRequestException("Too many failed attempts. Please request a new OTP.");
        }
        await this.prisma.passwordResetOtp.update({
            where: { id: otpRecord.id },
            data: { attempts: otpRecord.attempts + 1 },
        });
        return true;
    }
    async deleteOtp(userId) {
        await this.prisma.passwordResetOtp.deleteMany({
            where: { userId },
        });
    }
    async cleanupExpiredOtps() {
        await this.prisma.passwordResetOtp.deleteMany({
            where: {
                expiresAt: { lt: new Date() },
            },
        });
    }
};
exports.OtpService = OtpService;
exports.OtpService = OtpService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], OtpService);
//# sourceMappingURL=otp.service.js.map
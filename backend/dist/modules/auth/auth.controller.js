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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const password_service_1 = require("./password.service");
const dto_1 = require("./dto");
const session_guard_1 = require("./guards/session.guard");
let AuthController = class AuthController {
    constructor(authService, passwordService) {
        this.authService = authService;
        this.passwordService = passwordService;
    }
    async login(loginDto, req, res) {
        const deviceInfo = req.headers["user-agent"];
        const ipAddress = req.ip || req.socket.remoteAddress;
        const { user, accessToken } = await this.authService.login(loginDto, deviceInfo, ipAddress);
        const maxAge = this.authService.getSessionDurationMs();
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge,
        });
        return {
            message: "Login successful",
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                isTrial: user.isTrial,
            },
        };
    }
    async logout(req, res) {
        const sessionId = req.sessionId;
        if (sessionId) {
            await this.authService.logout(sessionId);
        }
        res.clearCookie("accessToken");
        return {
            message: "Logout successful",
        };
    }
    async getCurrentUser(req) {
        var _a, _b;
        const user = req.user;
        const response = {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isTrial: user.isTrial,
            isActive: user.isActive,
            subscription: user.subscription,
            createdAt: user.createdAt,
        };
        if (user.role === 'CANDIDATE' && user.candidateProfile) {
            response.partyName = (_a = user.candidateProfile.party) === null || _a === void 0 ? void 0 : _a.name;
            response.partyCode = (_b = user.candidateProfile.party) === null || _b === void 0 ? void 0 : _b.symbol;
        }
        return { user: response };
    }
    async refreshSession(req) {
        return {
            message: "Session refreshed",
            expiresIn: "9 days",
        };
    }
    async changePassword(req, changePasswordDto) {
        const userId = req.user.id;
        await this.passwordService.changePassword(userId, changePasswordDto);
        return {
            message: "Password changed successfully. Please login again with your new password.",
        };
    }
    async forgotPassword(forgotPasswordDto) {
        const result = await this.passwordService.forgotPassword(forgotPasswordDto);
        return result;
    }
    async resetPassword(resetPasswordDto) {
        await this.passwordService.resetPassword(resetPasswordDto);
        return {
            message: "Password reset successfully. You can now login with your new password.",
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)("login"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.LoginDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)("logout"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)("me"),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getCurrentUser", null);
__decorate([
    (0, common_1.Post)("refresh"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refreshSession", null);
__decorate([
    (0, common_1.Post)("change-password"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Post)("forgot-password"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, common_1.Post)("reset-password"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)("auth"),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        password_service_1.PasswordService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map
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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const admin_service_1 = require("./admin.service");
const auth_service_1 = require("../auth/auth.service");
const impersonation_service_1 = require("../auth/impersonation.service");
const email_service_1 = require("../email/email.service");
const session_guard_1 = require("../auth/guards/session.guard");
const impersonation_guard_1 = require("../auth/guards/impersonation.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const dto_1 = require("../auth/dto");
const dto_2 = require("./dto");
const user_provisioning_service_1 = require("./user-provisioning.service");
const prisma_service_1 = require("../../prisma/prisma.service");
let AdminController = class AdminController {
    constructor(adminService, authService, impersonationService, emailService, prisma, userProvisioningService) {
        this.adminService = adminService;
        this.authService = authService;
        this.impersonationService = impersonationService;
        this.emailService = emailService;
        this.prisma = prisma;
        this.userProvisioningService = userProvisioningService;
    }
    async createUser(createUserDto, req) {
        const adminId = req.user.id;
        const tempPassword = createUserDto.password || this.generateTempPassword();
        const provisionedUser = await this.userProvisioningService.provisionUser(createUserDto, adminId);
        await this.authService.setUserPassword(provisionedUser.id, tempPassword);
        if (provisionedUser.email) {
            await this.emailService.sendAccountCreatedEmail(provisionedUser.email, provisionedUser.fullName, provisionedUser.email || provisionedUser.phone, tempPassword, provisionedUser.isTrial);
        }
        return {
            message: "User created successfully",
            user: {
                id: provisionedUser.id,
                fullName: provisionedUser.fullName,
                email: provisionedUser.email,
                phone: provisionedUser.phone,
                role: provisionedUser.role,
                isTrial: provisionedUser.isTrial,
                subscription: provisionedUser.subscription
                    ? {
                        id: provisionedUser.subscription.id,
                        isTrial: provisionedUser.subscription.isTrial,
                        startsAt: provisionedUser.subscription.startsAt,
                        endsAt: provisionedUser.subscription.endsAt,
                        geoAccess: provisionedUser.subscription.access.map((a) => ({
                            geoUnitId: a.geoUnitId,
                            geoUnitName: a.geoUnit.name,
                            geoUnitLevel: a.geoUnit.level,
                        })),
                    }
                    : null,
            },
            tempPassword,
            emailSent: !!provisionedUser.email,
        };
    }
    generateTempPassword() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
        let password = "";
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }
    async listUsers(role, isActive, isTrial) {
        const filters = Object.assign(Object.assign(Object.assign({}, (role && { role })), (isActive !== undefined && { isActive: isActive === "true" })), (isTrial !== undefined && { isTrial: isTrial === "true" }));
        const users = await this.adminService.listUsers(filters);
        return {
            users,
            total: users.length,
        };
    }
    async getUserDetails(userId) {
        const user = await this.adminService.getUserDetails(userId);
        if (!user) {
            return { error: "User not found" };
        }
        return { user };
    }
    async updateUser(userId, updateUserDto) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: updateUserDto,
        });
        return {
            message: "User updated successfully",
            user,
        };
    }
    async deactivateUser(userId) {
        await this.authService.deactivateUser(userId);
        return {
            message: "User deactivated successfully",
        };
    }
    async reactivateUser(userId) {
        await this.authService.reactivateUser(userId);
        return {
            message: "User reactivated successfully",
        };
    }
    async createSubscription(userId, createSubscriptionDto, req) {
        const adminId = req.user.id;
        const subscription = await this.adminService.createSubscription(userId, createSubscriptionDto, adminId);
        return {
            message: "Subscription created successfully",
            subscription,
        };
    }
    async updateSubscription(userId, updateSubscriptionDto) {
        const subscription = await this.adminService.updateSubscription(userId, updateSubscriptionDto);
        return {
            message: "Subscription updated successfully",
            subscription,
        };
    }
    async grantGeoAccess(userId, grantGeoAccessDto) {
        const access = await this.adminService.grantGeoAccess(userId, grantGeoAccessDto);
        return {
            message: "Geo access granted successfully",
            access,
        };
    }
    async getUserGeoAccess(userId) {
        const access = await this.adminService.getUserGeoAccess(userId);
        return {
            access,
            total: access.length,
        };
    }
    async startImpersonation(impersonateDto, req, res) {
        const adminId = req.user.id;
        const deviceInfo = req.headers["user-agent"];
        const ipAddress = req.ip || req.socket.remoteAddress;
        const impersonationToken = await this.impersonationService.startImpersonation(adminId, impersonateDto, deviceInfo, ipAddress);
        res.cookie("impersonationToken", impersonationToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 4 * 60 * 60 * 1000,
        });
        const targetUser = await this.adminService.getUserDetails(impersonateDto.targetUserId);
        return {
            message: "Impersonation started",
            impersonationToken,
            targetUser: {
                id: targetUser.id,
                fullName: targetUser.fullName,
                email: targetUser.email,
                phone: targetUser.phone,
                role: targetUser.role,
            },
            expiresIn: "4 hours",
        };
    }
    async stopImpersonation(req, res) {
        const impersonationToken = req.impersonationToken;
        await this.impersonationService.stopImpersonation(impersonationToken, "EXPLICIT_STOP");
        res.clearCookie("impersonationToken");
        return {
            message: "Impersonation stopped",
        };
    }
    async getActiveImpersonations(req, adminId) {
        const requestingAdminId = req.user.id;
        const filterAdminId = adminId ? parseInt(adminId) : requestingAdminId;
        const impersonations = await this.impersonationService.getActiveImpersonations(filterAdminId);
        return {
            impersonations,
            total: impersonations.length,
        };
    }
    async getImpersonationHistory(req, adminId, limit) {
        const filterAdminId = adminId ? parseInt(adminId) : undefined;
        const limitNum = limit ? parseInt(limit) : 100;
        const history = await this.impersonationService.getImpersonationHistory(filterAdminId, limitNum);
        return {
            history,
            total: history.length,
        };
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Post)("users"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateUserDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createUser", null);
__decorate([
    (0, common_1.Get)("users"),
    __param(0, (0, common_1.Query)("role")),
    __param(1, (0, common_1.Query)("isActive")),
    __param(2, (0, common_1.Query)("isTrial")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Get)("users/:id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getUserDetails", null);
__decorate([
    (0, common_1.Patch)("users/:id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, dto_2.UpdateUserDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateUser", null);
__decorate([
    (0, common_1.Post)("users/:id/deactivate"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "deactivateUser", null);
__decorate([
    (0, common_1.Post)("users/:id/reactivate"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "reactivateUser", null);
__decorate([
    (0, common_1.Post)("users/:id/subscription"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, dto_2.CreateSubscriptionDto, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createSubscription", null);
__decorate([
    (0, common_1.Patch)("users/:id/subscription"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateSubscription", null);
__decorate([
    (0, common_1.Post)("users/:id/geo-access"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, dto_2.GrantGeoAccessDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "grantGeoAccess", null);
__decorate([
    (0, common_1.Get)("users/:id/geo-access"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getUserGeoAccess", null);
__decorate([
    (0, common_1.Post)("impersonate"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ImpersonateDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "startImpersonation", null);
__decorate([
    (0, common_1.Post)("stop-impersonation"),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(impersonation_guard_1.ImpersonationGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "stopImpersonation", null);
__decorate([
    (0, common_1.Get)("impersonations/active"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)("adminId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getActiveImpersonations", null);
__decorate([
    (0, common_1.Get)("impersonations/history"),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)("adminId")),
    __param(2, (0, common_1.Query)("limit")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getImpersonationHistory", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)("admin"),
    (0, common_1.UseGuards)(session_guard_1.SessionGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN"),
    __metadata("design:paramtypes", [admin_service_1.AdminService,
        auth_service_1.AuthService,
        impersonation_service_1.ImpersonationService,
        email_service_1.EmailService,
        prisma_service_1.PrismaService,
        user_provisioning_service_1.UserProvisioningService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map
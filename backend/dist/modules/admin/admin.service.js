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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let AdminService = class AdminService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createSubscription(userId, dto, adminId) {
        const subscription = await this.prisma.subscription.create({
            data: {
                userId,
                isTrial: dto.isTrial,
                startsAt: dto.startsAt,
                endsAt: dto.endsAt,
                createdByAdminId: adminId,
            },
        });
        if (dto.geoUnitIds && dto.geoUnitIds.length > 0) {
            await this.grantGeoAccess(userId, { geoUnitIds: dto.geoUnitIds });
        }
        return subscription;
    }
    async updateSubscription(userId, dto) {
        return this.prisma.subscription.update({
            where: { userId },
            data: {
                isTrial: dto.isTrial,
                startsAt: dto.startsAt,
                endsAt: dto.endsAt,
            },
        });
    }
    async grantGeoAccess(userId, dto) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new Error('User does not have a subscription');
        }
        await this.prisma.geoAccess.deleteMany({
            where: { subscriptionId: subscription.id },
        });
        for (const geoUnitId of dto.geoUnitIds) {
            await this.prisma.geoAccess.create({
                data: {
                    id: 0,
                    subscriptionId: subscription.id,
                    geoUnitId,
                },
            });
        }
        return this.prisma.geoAccess.findMany({
            where: { subscriptionId: subscription.id },
            include: { geoUnit: true },
        });
    }
    async getUserGeoAccess(userId) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
            include: {
                access: {
                    include: {
                        geoUnit: true,
                    },
                },
            },
        });
        return (subscription === null || subscription === void 0 ? void 0 : subscription.access) || [];
    }
    async listUsers(filters) {
        return this.prisma.user.findMany({
            where: Object.assign(Object.assign(Object.assign({}, ((filters === null || filters === void 0 ? void 0 : filters.role) && { role: filters.role })), ((filters === null || filters === void 0 ? void 0 : filters.isActive) !== undefined && { isActive: filters.isActive })), ((filters === null || filters === void 0 ? void 0 : filters.isTrial) !== undefined && { isTrial: filters.isTrial })),
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                isTrial: true,
                createdAt: true,
                subscription: {
                    include: {
                        access: {
                            include: {
                                geoUnit: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
    async getUserDetails(userId) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                isTrial: true,
                createdAt: true,
                updatedAt: true,
                subscription: {
                    include: {
                        access: {
                            include: {
                                geoUnit: true,
                            },
                        },
                    },
                },
                sessions: {
                    select: {
                        id: true,
                        createdAt: true,
                        expiresAt: true,
                        lastActivityAt: true,
                        deviceInfo: true,
                        ipAddress: true,
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
            },
        });
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map
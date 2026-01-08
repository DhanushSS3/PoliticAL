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
exports.ImpersonationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let ImpersonationService = class ImpersonationService {
    constructor(prisma) {
        this.prisma = prisma;
        this.IMPERSONATION_DURATION_HOURS = parseInt(process.env.IMPERSONATION_DURATION_HOURS || "4");
    }
    async startImpersonation(adminId, dto, deviceInfo, ipAddress) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + this.IMPERSONATION_DURATION_HOURS);
        const session = await this.prisma.impersonationSession.create({
            data: {
                adminId,
                targetUserId: dto.targetUserId,
                reason: dto.reason,
                deviceInfo,
                ipAddress,
                expiresAt,
            },
        });
        return session.id;
    }
    async stopImpersonation(impersonationToken, reason = "EXPLICIT_STOP") {
        await this.prisma.impersonationSession.update({
            where: { id: impersonationToken },
            data: {
                endedAt: new Date(),
                endReason: reason,
            },
        });
    }
    async endAllImpersonationsForAdmin(adminId) {
        await this.prisma.impersonationSession.updateMany({
            where: {
                adminId,
                endedAt: null,
            },
            data: {
                endedAt: new Date(),
                endReason: "ADMIN_LOGOUT",
            },
        });
    }
    async validateImpersonation(impersonationToken) {
        const session = await this.prisma.impersonationSession.findUnique({
            where: { id: impersonationToken },
            include: {
                admin: true,
                targetUser: {
                    include: {
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
                },
            },
        });
        if (!session) {
            return null;
        }
        if (session.endedAt) {
            return null;
        }
        const now = new Date();
        if (session.expiresAt < now) {
            await this.stopImpersonation(impersonationToken, "EXPIRED");
            return null;
        }
        if (!session.admin.isActive) {
            return null;
        }
        if (!session.targetUser.isActive) {
            return null;
        }
        return session;
    }
    async getActiveImpersonations(adminId) {
        return this.prisma.impersonationSession.findMany({
            where: Object.assign(Object.assign({}, (adminId ? { adminId } : {})), { endedAt: null, expiresAt: { gt: new Date() } }),
            include: {
                admin: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                    },
                },
                targetUser: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }
    async getImpersonationHistory(adminId, limit = 100) {
        return this.prisma.impersonationSession.findMany({
            where: adminId ? { adminId } : {},
            include: {
                admin: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                    },
                },
                targetUser: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            take: limit,
        });
    }
};
exports.ImpersonationService = ImpersonationService;
exports.ImpersonationService = ImpersonationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ImpersonationService);
//# sourceMappingURL=impersonation.service.js.map
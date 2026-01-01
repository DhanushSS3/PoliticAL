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
exports.UserProvisioningService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const config_1 = require("@nestjs/config");
let UserProvisioningService = class UserProvisioningService {
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
    }
    async provisionUser(dto, createdByAdminId) {
        var _a;
        if (dto.role === 'SUBSCRIBER' && !dto.subscription) {
            throw new common_1.BadRequestException('Subscription details required for SUBSCRIBER role');
        }
        if (dto.subscription && dto.subscription.geoUnitIds.length === 0) {
            throw new common_1.BadRequestException('At least one geo unit must be assigned');
        }
        if ((_a = dto.subscription) === null || _a === void 0 ? void 0 : _a.isTrial) {
            const maxConstituencies = this.configService.get('TRIAL_MAX_CONSTITUENCIES', 3);
            if (dto.subscription.geoUnitIds.length > maxConstituencies) {
                throw new common_1.BadRequestException(`Trial users can access maximum ${maxConstituencies} constituencies`);
            }
        }
        const subscriptionDates = this.calculateSubscriptionDates(dto.subscription);
        return this.prisma.$transaction(async (tx) => {
            var _a;
            const user = await tx.user.create({
                data: {
                    fullName: dto.fullName,
                    email: dto.email,
                    phone: dto.phone,
                    passwordHash: '',
                    role: dto.role,
                    isTrial: ((_a = dto.subscription) === null || _a === void 0 ? void 0 : _a.isTrial) || false,
                },
            });
            let subscription = null;
            if (dto.subscription) {
                subscription = await tx.subscription.create({
                    data: {
                        userId: user.id,
                        isTrial: dto.subscription.isTrial,
                        startsAt: subscriptionDates.startsAt,
                        endsAt: subscriptionDates.endsAt,
                        createdByAdminId,
                    },
                });
                for (const geoUnitId of dto.subscription.geoUnitIds) {
                    await tx.geoAccess.create({
                        data: {
                            id: 0,
                            subscriptionId: subscription.id,
                            geoUnitId,
                        },
                    });
                }
            }
            const completeUser = await tx.user.findUnique({
                where: { id: user.id },
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
            });
            return completeUser;
        });
    }
    calculateSubscriptionDates(subscription) {
        if (!subscription) {
            return { startsAt: new Date(), endsAt: null };
        }
        const startsAt = new Date();
        let endsAt = null;
        if (subscription.isTrial) {
            const trialDays = subscription.durationDays ||
                this.configService.get('TRIAL_DURATION_DAYS', 1);
            endsAt = new Date();
            endsAt.setDate(endsAt.getDate() + trialDays);
        }
        else if (subscription.durationDays) {
            endsAt = new Date();
            endsAt.setDate(endsAt.getDate() + subscription.durationDays);
        }
        return { startsAt, endsAt };
    }
    async updateGeoAccess(userId, geoUnitIds) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new common_1.BadRequestException('User does not have a subscription');
        }
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user.isTrial) {
            const maxConstituencies = this.configService.get('TRIAL_MAX_CONSTITUENCIES', 3);
            if (geoUnitIds.length > maxConstituencies) {
                throw new common_1.BadRequestException(`Trial users can access maximum ${maxConstituencies} constituencies`);
            }
        }
        return this.prisma.$transaction(async (tx) => {
            await tx.geoAccess.deleteMany({
                where: { subscriptionId: subscription.id },
            });
            for (const geoUnitId of geoUnitIds) {
                await tx.geoAccess.create({
                    data: {
                        id: 0,
                        subscriptionId: subscription.id,
                        geoUnitId,
                    },
                });
            }
            return tx.geoAccess.findMany({
                where: { subscriptionId: subscription.id },
                include: { geoUnit: true },
            });
        });
    }
    async extendSubscription(userId, additionalDays) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new common_1.BadRequestException('User does not have a subscription');
        }
        const currentEndsAt = subscription.endsAt || new Date();
        const newEndsAt = new Date(currentEndsAt);
        newEndsAt.setDate(newEndsAt.getDate() + additionalDays);
        return this.prisma.subscription.update({
            where: { userId },
            data: { endsAt: newEndsAt },
        });
    }
    async convertTrialToPaid(userId, durationDays) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user.isTrial) {
            throw new common_1.BadRequestException('User is not a trial user');
        }
        return this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { isTrial: false },
            });
            const newEndsAt = durationDays ? new Date() : null;
            if (newEndsAt && durationDays) {
                newEndsAt.setDate(newEndsAt.getDate() + durationDays);
            }
            return tx.subscription.update({
                where: { userId },
                data: {
                    isTrial: false,
                    endsAt: newEndsAt,
                },
            });
        });
    }
};
exports.UserProvisioningService = UserProvisioningService;
exports.UserProvisioningService = UserProvisioningService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], UserProvisioningService);
//# sourceMappingURL=user-provisioning.service.js.map
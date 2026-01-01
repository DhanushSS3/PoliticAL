import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from '../auth/dto';

/**
 * UserProvisioningService
 * 
 * Handles atomic user creation with subscription and geo access.
 * Follows Single Responsibility Principle - only concerned with user provisioning.
 */
@Injectable()
export class UserProvisioningService {
    constructor(
        private prisma: PrismaService,
        private configService: ConfigService
    ) { }

    /**
     * Create user with subscription and geo access in a single transaction
     * 
     * This follows industry best practices:
     * - Stripe: Customer creation includes payment method and subscription
     * - AWS IAM: User creation includes policies and permissions
     * - Auth0: User creation includes roles and metadata
     * 
     * Benefits:
     * - Atomic operation (all or nothing)
     * - No orphaned users without subscriptions
     * - Immediate access after creation
     * - Single email with complete setup
     */
    async provisionUser(dto: CreateUserDto, createdByAdminId: number) {
        // Validate subscription requirements
        if (dto.role === 'SUBSCRIBER' && !dto.subscription) {
            throw new BadRequestException('Subscription details required for SUBSCRIBER role');
        }

        if (dto.subscription && dto.subscription.geoUnitIds.length === 0) {
            throw new BadRequestException('At least one geo unit must be assigned');
        }

        // For trial users, enforce max constituencies limit
        if (dto.subscription?.isTrial) {
            const maxConstituencies = this.configService.get<number>('TRIAL_MAX_CONSTITUENCIES', 3);
            if (dto.subscription.geoUnitIds.length > maxConstituencies) {
                throw new BadRequestException(
                    `Trial users can access maximum ${maxConstituencies} constituencies`
                );
            }
        }

        // Calculate subscription dates
        const subscriptionDates = this.calculateSubscriptionDates(dto.subscription);

        // Execute atomic transaction
        return this.prisma.$transaction(async (tx) => {
            // 1. Create user
            const user = await tx.user.create({
                data: {
                    fullName: dto.fullName,
                    email: dto.email,
                    phone: dto.phone,
                    passwordHash: '', // Will be set by AuthService
                    role: dto.role,
                    isTrial: dto.subscription?.isTrial || false,
                },
            });

            // 2. Create subscription (if provided)
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

                // 3. Create geo access entries
                for (const geoUnitId of dto.subscription.geoUnitIds) {
                    await tx.geoAccess.create({
                        data: {
                            id: 0, // Auto-generated
                            subscriptionId: subscription.id,
                            geoUnitId,
                        },
                    });
                }
            }

            // 4. Fetch complete user with relations
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

    /**
     * Calculate subscription start and end dates
     */
    private calculateSubscriptionDates(subscription?: CreateUserDto['subscription']) {
        if (!subscription) {
            return { startsAt: new Date(), endsAt: null };
        }

        const startsAt = new Date();
        let endsAt: Date | null = null;

        if (subscription.isTrial) {
            // Trial users: use configured duration or default
            const trialDays = subscription.durationDays ||
                this.configService.get<number>('TRIAL_DURATION_DAYS', 1);
            endsAt = new Date();
            endsAt.setDate(endsAt.getDate() + trialDays);
        } else if (subscription.durationDays) {
            // Paid users with specific duration
            endsAt = new Date();
            endsAt.setDate(endsAt.getDate() + subscription.durationDays);
        }
        // else: lifetime subscription (endsAt = null)

        return { startsAt, endsAt };
    }

    /**
     * Update user's geo access
     * Separate method following Open/Closed Principle
     */
    async updateGeoAccess(userId: number, geoUnitIds: number[]) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription) {
            throw new BadRequestException('User does not have a subscription');
        }

        // Check trial limits
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user.isTrial) {
            const maxConstituencies = this.configService.get<number>('TRIAL_MAX_CONSTITUENCIES', 3);
            if (geoUnitIds.length > maxConstituencies) {
                throw new BadRequestException(
                    `Trial users can access maximum ${maxConstituencies} constituencies`
                );
            }
        }

        return this.prisma.$transaction(async (tx) => {
            // Delete existing access
            await tx.geoAccess.deleteMany({
                where: { subscriptionId: subscription.id },
            });

            // Create new access
            for (const geoUnitId of geoUnitIds) {
                await tx.geoAccess.create({
                    data: {
                        id: 0,
                        subscriptionId: subscription.id,
                        geoUnitId,
                    },
                });
            }

            // Return updated access
            return tx.geoAccess.findMany({
                where: { subscriptionId: subscription.id },
                include: { geoUnit: true },
            });
        });
    }

    /**
     * Extend subscription duration
     */
    async extendSubscription(userId: number, additionalDays: number) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });

        if (!subscription) {
            throw new BadRequestException('User does not have a subscription');
        }

        const currentEndsAt = subscription.endsAt || new Date();
        const newEndsAt = new Date(currentEndsAt);
        newEndsAt.setDate(newEndsAt.getDate() + additionalDays);

        return this.prisma.subscription.update({
            where: { userId },
            data: { endsAt: newEndsAt },
        });
    }

    /**
     * Convert trial to paid subscription
     */
    async convertTrialToPaid(userId: number, durationDays?: number) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user.isTrial) {
            throw new BadRequestException('User is not a trial user');
        }

        return this.prisma.$transaction(async (tx) => {
            // Update user
            await tx.user.update({
                where: { id: userId },
                data: { isTrial: false },
            });

            // Update subscription
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
}

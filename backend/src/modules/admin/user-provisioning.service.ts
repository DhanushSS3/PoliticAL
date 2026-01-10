import { Injectable, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { CreateUserDto } from "../auth/dto";
import { GeoHierarchyService } from "./geo-hierarchy.service";
import { MonitoringManagerService } from "../analytics/services/monitoring-manager.service";

/**
 * UserProvisioningService
 * Handles atomic user creation with subscription and geo access.
 */
@Injectable()
export class UserProvisioningService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private geoHierarchyService: GeoHierarchyService,
    private monitoringManager: MonitoringManagerService,
  ) { }

  async provisionUser(dto: CreateUserDto, createdByAdminId: number) {
    // Validate subscription requirements
    if (dto.role === "SUBSCRIBER" && !dto.subscription) {
      throw new BadRequestException("Subscription details required for SUBSCRIBER role");
    }

    if (dto.subscription) {
      if (!dto.subscription.geoUnitIds || dto.subscription.geoUnitIds.length === 0) {
        throw new BadRequestException("At least one geo unit must be assigned");
      }
      if (dto.subscription.durationDays === undefined) {
        throw new BadRequestException("Subscription duration is required. Set durationDays or null for lifetime");
      }

      await this.geoHierarchyService.validateGeoUnits(dto.subscription.geoUnitIds);

      if (dto.subscription.isTrial) {
        const maxConstituencies = this.configService.get<number>("TRIAL_MAX_CONSTITUENCIES", 3);
        if (dto.subscription.geoUnitIds.length > maxConstituencies) {
          throw new BadRequestException(`Trial users can select maximum ${maxConstituencies} geo units (children are auto-included)`);
        }
        if (dto.subscription.durationDays === null || dto.subscription.durationDays <= 0) {
          throw new BadRequestException("Trial subscriptions must have a valid expiry duration");
        }
      }
    }

    let expandedGeoUnitIds: number[] = [];
    if (dto.subscription) {
      expandedGeoUnitIds = await this.geoHierarchyService.expandGeoUnitsWithChildren(dto.subscription.geoUnitIds);
    }

    const subscriptionDates = this.calculateSubscriptionDates(dto.subscription);
    let result;

    try {
      result = await this.prisma.$transaction(async (tx) => {
        // 1. Create user
        const user = await tx.user.create({
          data: {
            fullName: dto.fullName,
            email: dto.email,
            phone: dto.phone,
            passwordHash: "",
            role: dto.role,
            isTrial: dto.subscription?.isTrial || false,
          },
        });

        // 2. Create subscription
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

          // 3. Geo Access
          for (const geoUnitId of expandedGeoUnitIds) {
            await tx.geoAccess.create({
              data: { id: 0, subscriptionId: subscription.id, geoUnitId },
            });
          }
        }

        return tx.user.findUnique({
          where: { id: user.id },
          include: {
            subscription: {
              include: { access: { include: { geoUnit: true } } },
            },
          },
        });
      });
    } catch (error) {
      if (error.code === "P2002") {
        const target = error.meta?.target;
        const field = Array.isArray(target) ? target.join(", ") : target;
        throw new ConflictException(`User with this ${field || "credential"} already exists`);
      }
      throw error;
    }

    // Trigger Monitoring (Viewer Mode)
    if (expandedGeoUnitIds.length > 0) {
      // Use Promise.all to parallelize, but map limitedly if concerns arise.
      // Assuming number of units is within reasonable limits (e.g. state = 224 constituencies)
      await Promise.all(expandedGeoUnitIds.map(id => this.monitoringManager.activateGeoScope(id)));
    }

    return result;
  }

  private calculateSubscriptionDates(subscription?: CreateUserDto["subscription"]) {
    if (!subscription) return { startsAt: new Date(), endsAt: null };
    const startsAt = new Date();
    let endsAt: Date | null = null;

    if (subscription.durationDays === null) endsAt = null;
    else if (subscription.durationDays > 0) {
      endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + subscription.durationDays);
    } else {
      throw new BadRequestException("Duration must be a positive number or null for lifetime");
    }
    return { startsAt, endsAt };
  }

  async updateGeoAccess(userId: number, geoUnitIds: number[]) {
    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) throw new BadRequestException("User does not have a subscription");

    await this.geoHierarchyService.validateGeoUnits(geoUnitIds);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user.isTrial) {
      const maxConstituencies = this.configService.get<number>("TRIAL_MAX_CONSTITUENCIES", 3);
      if (geoUnitIds.length > maxConstituencies) {
        throw new BadRequestException(`Trial users can select maximum ${maxConstituencies} geo units`);
      }
    }

    const expandedGeoUnitIds = await this.geoHierarchyService.expandGeoUnitsWithChildren(geoUnitIds);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.geoAccess.deleteMany({ where: { subscriptionId: subscription.id } });
      for (const geoUnitId of expandedGeoUnitIds) {
        await tx.geoAccess.create({
          data: { id: 0, subscriptionId: subscription.id, geoUnitId },
        });
      }
      return tx.geoAccess.findMany({
        where: { subscriptionId: subscription.id },
        include: { geoUnit: true },
      });
    });

    // Trigger Monitoring
    if (expandedGeoUnitIds.length > 0) {
      await Promise.all(expandedGeoUnitIds.map(id => this.monitoringManager.activateGeoScope(id)));
    }

    return result;
  }

  async extendSubscription(userId: number, additionalDays: number) {
    const subscription = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) throw new BadRequestException("User does not have a subscription");

    const currentEndsAt = subscription.endsAt || new Date();
    const newEndsAt = new Date(currentEndsAt);
    newEndsAt.setDate(newEndsAt.getDate() + additionalDays);

    return this.prisma.subscription.update({
      where: { userId },
      data: { endsAt: newEndsAt },
    });
  }

  async convertTrialToPaid(userId: number, durationDays?: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user.isTrial) throw new BadRequestException("User is not a trial user");

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { isTrial: false } });
      const newEndsAt = durationDays ? new Date() : null;
      if (newEndsAt && durationDays) newEndsAt.setDate(newEndsAt.getDate() + durationDays);

      return tx.subscription.update({
        where: { userId },
        data: { isTrial: false, endsAt: newEndsAt },
      });
    });
  }
}

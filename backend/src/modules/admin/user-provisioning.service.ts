import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { CreateUserDto } from "../auth/dto";
import { GeoHierarchyService } from "./geo-hierarchy.service";

/**
 * UserProvisioningService
 *
 * Handles atomic user creation with subscription and geo access.
 * Follows Single Responsibility Principle - only concerned with user provisioning.
 *
 * Industry best practices:
 * 1. Auto-generate passwords (like AWS, Google Workspace)
 * 2. Require explicit subscription duration (no defaults)
 * 3. Hierarchical permissions (like AWS IAM)
 */
@Injectable()
export class UserProvisioningService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private geoHierarchyService: GeoHierarchyService,
  ) {}

  /**
   * Create user with subscription and geo access in a single transaction
   *
   * Password Strategy (Industry Standard):
   * - Auto-generate secure random password (default)
   * - Admin can override with custom password (optional)
   * - Similar to: AWS IAM, Google Workspace, Microsoft 365
   *
   * Duration Strategy:
   * - Admin MUST specify duration (no defaults)
   * - Prevents accidental lifetime subscriptions
   * - Forces conscious decision on access duration
   *
   * Geo Access Strategy:
   * - Parent geo units include all children (hierarchical)
   * - Similar to: AWS IAM resource hierarchy, Google Cloud IAM
   */
  async provisionUser(dto: CreateUserDto, createdByAdminId: number) {
    // Validate subscription requirements
    if (dto.role === "SUBSCRIBER" && !dto.subscription) {
      throw new BadRequestException(
        "Subscription details required for SUBSCRIBER role",
      );
    }

    if (dto.subscription) {
      // Validate geo units provided
      if (
        !dto.subscription.geoUnitIds ||
        dto.subscription.geoUnitIds.length === 0
      ) {
        throw new BadRequestException("At least one geo unit must be assigned");
      }

      // Validate duration is explicitly set
      if (dto.subscription.durationDays === undefined) {
        throw new BadRequestException(
          "Subscription duration is required. Set durationDays (e.g., 30, 365) or null for lifetime",
        );
      }

      // Validate geo units exist
      await this.geoHierarchyService.validateGeoUnits(
        dto.subscription.geoUnitIds,
      );

      // For trial users, enforce max constituencies limit
      if (dto.subscription.isTrial) {
        const maxConstituencies = this.configService.get<number>(
          "TRIAL_MAX_CONSTITUENCIES",
          3,
        );
        if (dto.subscription.geoUnitIds.length > maxConstituencies) {
          throw new BadRequestException(
            `Trial users can select maximum ${maxConstituencies} geo units (children are auto-included)`,
          );
        }

        // Trial users must have expiry
        if (
          dto.subscription.durationDays === null ||
          dto.subscription.durationDays <= 0
        ) {
          throw new BadRequestException(
            "Trial subscriptions must have a valid expiry duration",
          );
        }
      }
    }

    // Expand geo units to include all children (hierarchical access)
    let expandedGeoUnitIds: number[] = [];
    if (dto.subscription) {
      expandedGeoUnitIds =
        await this.geoHierarchyService.expandGeoUnitsWithChildren(
          dto.subscription.geoUnitIds,
        );
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
          passwordHash: "", // Will be set by AuthService
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

        // 3. Create geo access entries (using expanded IDs with children)
        for (const geoUnitId of expandedGeoUnitIds) {
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
   * Duration is REQUIRED - admin must explicitly set expiry
   */
  private calculateSubscriptionDates(
    subscription?: CreateUserDto["subscription"],
  ) {
    if (!subscription) {
      return { startsAt: new Date(), endsAt: null };
    }

    const startsAt = new Date();
    let endsAt: Date | null = null;

    if (subscription.durationDays === null) {
      // Lifetime subscription
      endsAt = null;
    } else if (subscription.durationDays > 0) {
      // Specific duration
      endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + subscription.durationDays);
    } else {
      throw new BadRequestException(
        "Duration must be a positive number or null for lifetime",
      );
    }

    return { startsAt, endsAt };
  }

  /**
   * Update user's geo access (with hierarchical expansion)
   */
  async updateGeoAccess(userId: number, geoUnitIds: number[]) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new BadRequestException("User does not have a subscription");
    }

    // Validate geo units
    await this.geoHierarchyService.validateGeoUnits(geoUnitIds);

    // Check trial limits
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user.isTrial) {
      const maxConstituencies = this.configService.get<number>(
        "TRIAL_MAX_CONSTITUENCIES",
        3,
      );
      if (geoUnitIds.length > maxConstituencies) {
        throw new BadRequestException(
          `Trial users can select maximum ${maxConstituencies} geo units (children are auto-included)`,
        );
      }
    }

    // Expand geo units to include children
    const expandedGeoUnitIds =
      await this.geoHierarchyService.expandGeoUnitsWithChildren(geoUnitIds);

    return this.prisma.$transaction(async (tx) => {
      // Delete existing access
      await tx.geoAccess.deleteMany({
        where: { subscriptionId: subscription.id },
      });

      // Create new access (with expanded IDs)
      for (const geoUnitId of expandedGeoUnitIds) {
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
      throw new BadRequestException("User does not have a subscription");
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
      throw new BadRequestException("User is not a trial user");
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

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSubscriptionDto, GrantGeoAccessDto } from "./dto";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create subscription for a user
   */
  async createSubscription(
    userId: number,
    dto: CreateSubscriptionDto,
    adminId: number,
  ) {
    // Create subscription
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        isTrial: dto.isTrial,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        createdByAdminId: adminId,
      },
    });

    // Grant geo access if provided
    if (dto.geoUnitIds && dto.geoUnitIds.length > 0) {
      await this.grantGeoAccess(userId, { geoUnitIds: dto.geoUnitIds });
    }

    return subscription;
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    userId: number,
    dto: Partial<CreateSubscriptionDto>,
  ) {
    return this.prisma.subscription.update({
      where: { userId },
      data: {
        isTrial: dto.isTrial,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
      },
    });
  }

  /**
   * Grant geo access to user
   */
  async grantGeoAccess(userId: number, dto: GrantGeoAccessDto) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new Error("User does not have a subscription");
    }

    // Create new access entries (GeoAccess uses composite primary key but also has id field)
    await this.prisma.geoAccess.deleteMany({
      where: { subscriptionId: subscription.id },
    });

    // Create access entries
    for (const geoUnitId of dto.geoUnitIds) {
      await this.prisma.geoAccess.create({
        data: {
          id: 0, // Auto-generated, but required in schema
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

  /**
   * Get user's geo access
   */
  async getUserGeoAccess(userId: number) {
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

    return subscription?.access || [];
  }

  /**
   * List all users (admin only)
   */
  async listUsers(filters?: {
    role?: string;
    isActive?: boolean;
    isTrial?: boolean;
  }) {
    return this.prisma.user.findMany({
      where: {
        ...(filters?.role && { role: filters.role as any }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters?.isTrial !== undefined && { isTrial: filters.isTrial }),
      },
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
        createdAt: "desc",
      },
    });
  }

  /**
   * Get user details
   */
  async getUserDetails(userId: number) {
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
            createdAt: "desc",
          },
        },
      },
    });
  }
}

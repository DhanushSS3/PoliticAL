import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ImpersonateDto } from "./dto";
import { ImpersonationSession } from "@prisma/client";

@Injectable()
export class ImpersonationService {
  constructor(private prisma: PrismaService) {}

  private readonly IMPERSONATION_DURATION_HOURS = parseInt(
    process.env.IMPERSONATION_DURATION_HOURS || "4",
  );

  /**
   * Start impersonation session
   */
  async startImpersonation(
    adminId: number,
    dto: ImpersonateDto,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<string> {
    const expiresAt = new Date();
    expiresAt.setHours(
      expiresAt.getHours() + this.IMPERSONATION_DURATION_HOURS,
    );

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

  /**
   * Stop impersonation session
   */
  async stopImpersonation(
    impersonationToken: string,
    reason: string = "EXPLICIT_STOP",
  ): Promise<void> {
    await this.prisma.impersonationSession.update({
      where: { id: impersonationToken },
      data: {
        endedAt: new Date(),
        endReason: reason,
      },
    });
  }

  /**
   * End all impersonation sessions for an admin (when admin logs out)
   */
  async endAllImpersonationsForAdmin(adminId: number): Promise<void> {
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

  /**
   * Validate impersonation token
   */
  async validateImpersonation(
    impersonationToken: string,
  ): Promise<(ImpersonationSession & { admin: any; targetUser: any }) | null> {
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

    // Check if already ended
    if (session.endedAt) {
      return null;
    }

    // Check expiry
    const now = new Date();
    if (session.expiresAt < now) {
      // Auto-expire
      await this.stopImpersonation(impersonationToken, "EXPIRED");
      return null;
    }

    // Check admin is still active
    if (!session.admin.isActive) {
      return null;
    }

    // Check target user is still active
    if (!session.targetUser.isActive) {
      return null;
    }

    return session;
  }

  /**
   * Get active impersonations (for audit)
   */
  async getActiveImpersonations(adminId?: number) {
    return this.prisma.impersonationSession.findMany({
      where: {
        ...(adminId ? { adminId } : {}),
        endedAt: null,
        expiresAt: { gt: new Date() },
      },
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

  /**
   * Get impersonation history (audit log)
   */
  async getImpersonationHistory(adminId?: number, limit: number = 100) {
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
}

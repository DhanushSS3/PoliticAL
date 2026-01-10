import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { LoginDto, CreateUserDto, CreateSessionDto } from "./dto";
import * as bcrypt from "bcrypt";
import { User, Session } from "@prisma/client";
import { sign, verify } from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";

export interface AccessTokenPayload extends JwtPayload {
  sid: string;
  uid: number;
}

@Injectable()
export class AuthService {
  private readonly SESSION_DURATION_DAYS = parseInt(
    process.env.SESSION_DURATION_DAYS || "9",
  );
  private readonly sessionDurationMs: number;
  private readonly tokenExpirySeconds: number;
  private readonly jwtSecret: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.sessionDurationMs = this.SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;
    this.tokenExpirySeconds = this.sessionDurationMs / 1000;
    this.jwtSecret = this.configService.get<string>("auth.secret", "dev_secret");
  }

  getSessionDurationMs(): number {
    return this.sessionDurationMs;
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return verify(token, this.jwtSecret) as AccessTokenPayload;
  }

  private createAccessToken(session: Session): string {
    const payload: AccessTokenPayload = {
      sid: session.id,
      uid: session.userId,
    };

    return sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpirySeconds,
    });
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Find user by email or phone
   */
  async findByEmailOrPhone(emailOrPhone: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrPhone }, { phone: emailOrPhone }],
      },
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
  }

  /**
   * Login with email/phone + password
   */
  async login(
    dto: LoginDto,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<{ user: any; accessToken: string }> {
    // Find user
    const user = await this.findByEmailOrPhone(dto.emailOrPhone);

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check if user is active
    if (!user.isActive) {
      throw new ForbiddenException("Account has been deactivated");
    }

    // Check trial expiry
    if (user.isTrial && (user as any).subscription) {
      const now = new Date();
      if (
        (user as any).subscription.endsAt &&
        (user as any).subscription.endsAt < now
      ) {
        throw new ForbiddenException("Trial period has expired");
      }
    }

    // Enforce single-device: Delete all existing sessions
    await this.invalidateAllUserSessions(user.id);

    // Create new session
    const session = await this.createSession({
      userId: user.id,
      deviceInfo,
      ipAddress,
    });

    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user;

    const accessToken = this.createAccessToken(session);

    return {
      user: userWithoutPassword as any,
      accessToken,
    };
  }

  /**
   * Create a new session for user
   */
  async createSession(dto: CreateSessionDto): Promise<Session> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.SESSION_DURATION_DAYS);

    return this.prisma.session.create({
      data: {
        userId: dto.userId,
        deviceInfo: dto.deviceInfo,
        ipAddress: dto.ipAddress,
        expiresAt,
      },
    });
  }

  /**
   * Validate session token
   */
  async validateSession(
    sessionId: string,
    context: {
      expectedUserId?: number;
      deviceInfo?: string;
      ipAddress?: string;
    } = {},
  ): Promise<User | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
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

    if (!session || session.revoked) {
      return null;
    }

    if (
      context.expectedUserId !== undefined &&
      session.userId !== context.expectedUserId
    ) {
      await this.logout(sessionId);
      return null;
    }

    if (
      session.deviceInfo &&
      context.deviceInfo &&
      session.deviceInfo !== context.deviceInfo
    ) {
      await this.logout(sessionId);
      return null;
    }

    // Check expiry
    const now = new Date();
    if (session.expiresAt < now) {
      await this.logout(sessionId);
      return null;
    }

    if (
      session.ipAddress &&
      context.ipAddress &&
      session.ipAddress !== context.ipAddress
    ) {
      // Soft check: log suspicious activity but do not block immediately
      console.warn(
        `[Auth] IP mismatch for session ${sessionId}: stored ${session.ipAddress}, received ${context.ipAddress}`,
      );
    }

    // Check user is active
    if (!session.user.isActive) {
      await this.logout(sessionId);
      return null;
    }

    // Check trial expiry
    if (session.user.isTrial && session.user.subscription) {
      if (
        session.user.subscription.endsAt &&
        session.user.subscription.endsAt < now
      ) {
        await this.logout(sessionId);
        return null;
      }
    }

    // Update last activity
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastActivityAt: now },
    });

    return session.user;
  }

  /**
   * Logout (destroy session)
   */
  async logout(sessionId: string): Promise<void> {
    await this.prisma.session
      .update({
        where: { id: sessionId },
        data: { revoked: true, expiresAt: new Date() },
      })
      .catch(() => {
        // Session may already be revoked or missing
      });
  }

  /**
   * Invalidate all sessions for a user (single-device enforcement)
   */
  async invalidateAllUserSessions(userId: number): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, expiresAt: new Date() },
    });
  }

  /**
   * Create a new user (used by UserProvisioningService)
   * This method only handles user creation and password hashing
   * Subscription and geo access are handled by UserProvisioningService
   */
  async createUserWithPassword(
    fullName: string,
    email: string | undefined,
    phone: string,
    password: string | undefined,
    role: "ADMIN" | "SUBSCRIBER",
    isTrial: boolean,
  ): Promise<{ user: any; tempPassword: string }> {
    // Generate temporary password if not provided
    const tempPassword = password || this.generateTempPassword();
    const hashedPassword = await this.hashPassword(tempPassword);

    const user = await this.prisma.user.create({
      data: {
        fullName,
        email,
        phone,
        passwordHash: hashedPassword,
        role,
        isTrial,
      },
    });

    return { user, tempPassword };
  }

  /**
   * Update user's password hash (used by UserProvisioningService after user creation)
   */
  async setUserPassword(userId: number, password: string): Promise<void> {
    const hashedPassword = await this.hashPassword(password);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });
  }

  /**
   * Generate temporary password
   */
  private generateTempPassword(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Deactivate user
   */
  async deactivateUser(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    // Immediately invalidate all sessions
    await this.invalidateAllUserSessions(userId);
  }

  /**
   * Reactivate user
   */
  async reactivateUser(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
  }
}

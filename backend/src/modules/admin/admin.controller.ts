import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AuthService } from "../auth/auth.service";
import { ImpersonationService } from "../auth/impersonation.service";
import { EmailService } from "../email/email.service";
import { SessionGuard } from "../auth/guards/session.guard";
import { ImpersonationGuard } from "../auth/guards/impersonation.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CreateUserDto, ImpersonateDto } from "../auth/dto";
import { CreateSubscriptionDto, GrantGeoAccessDto, UpdateUserDto } from "./dto";
import { UserProvisioningService } from "./user-provisioning.service";
import { PrismaService } from "../../prisma/prisma.service";
import { Request, Response } from "express";

@Controller("admin")
@UseGuards(SessionGuard, RolesGuard)
@Roles("ADMIN")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
    private readonly impersonationService: ImpersonationService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly userProvisioningService: UserProvisioningService,
  ) {}

  /**
   * Create a new user with subscription and geo access (atomic operation)
   *
   * Industry best practice: All user setup in one API call
   * - Stripe: Create customer with payment method and subscription
   * - AWS: Create user with policies attached
   * - Auth0: Create user with roles and metadata
   *
   * Benefits:
   * - No orphaned users
   * - Immediate access
   * - Single email notification
   * - Atomic transaction (all or nothing)
   */
  @Post("users")
  async createUser(@Body() createUserDto: CreateUserDto, @Req() req: any) {
    const adminId = req.user.id;

    // Generate password if not provided
    const tempPassword = createUserDto.password || this.generateTempPassword();

    // Step 1: Provision user with subscription and geo access (atomic)
    const provisionedUser = await this.userProvisioningService.provisionUser(
      createUserDto,
      adminId,
    );

    // Step 2: Set password
    await this.authService.setUserPassword(provisionedUser.id, tempPassword);

    // Step 3: Send account creation email if email provided
    if (provisionedUser.email) {
      await this.emailService.sendAccountCreatedEmail(
        provisionedUser.email,
        provisionedUser.fullName,
        provisionedUser.email || provisionedUser.phone,
        tempPassword,
        provisionedUser.isTrial,
      );
    }

    // Step 4: Return response
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
      tempPassword, // Return for admin to share if email not sent
      emailSent: !!provisionedUser.email,
    };
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
   * List all users
   */
  @Get("users")
  async listUsers(
    @Query("role") role?: string,
    @Query("isActive") isActive?: string,
    @Query("isTrial") isTrial?: string,
  ) {
    const filters = {
      ...(role && { role }),
      ...(isActive !== undefined && { isActive: isActive === "true" }),
      ...(isTrial !== undefined && { isTrial: isTrial === "true" }),
    };

    const users = await this.adminService.listUsers(filters);

    return {
      users,
      total: users.length,
    };
  }

  /**
   * Get user details
   */
  @Get("users/:id")
  async getUserDetails(@Param("id", ParseIntPipe) userId: number) {
    const user = await this.adminService.getUserDetails(userId);

    if (!user) {
      return { error: "User not found" };
    }

    return { user };
  }

  /**
   * Update user
   */
  @Patch("users/:id")
  async updateUser(
    @Param("id", ParseIntPipe) userId: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateUserDto,
    });

    return {
      message: "User updated successfully",
      user,
    };
  }

  /**
   * Deactivate user
   */
  @Post("users/:id/deactivate")
  @HttpCode(HttpStatus.OK)
  async deactivateUser(@Param("id", ParseIntPipe) userId: number) {
    await this.authService.deactivateUser(userId);

    return {
      message: "User deactivated successfully",
    };
  }

  /**
   * Reactivate user
   */
  @Post("users/:id/reactivate")
  @HttpCode(HttpStatus.OK)
  async reactivateUser(@Param("id", ParseIntPipe) userId: number) {
    await this.authService.reactivateUser(userId);

    return {
      message: "User reactivated successfully",
    };
  }

  /**
   * Create subscription for user
   */
  @Post("users/:id/subscription")
  async createSubscription(
    @Param("id", ParseIntPipe) userId: number,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
    @Req() req: any,
  ) {
    const adminId = req.user.id;

    const subscription = await this.adminService.createSubscription(
      userId,
      createSubscriptionDto,
      adminId,
    );

    return {
      message: "Subscription created successfully",
      subscription,
    };
  }

  /**
   * Update subscription
   */
  @Patch("users/:id/subscription")
  async updateSubscription(
    @Param("id", ParseIntPipe) userId: number,
    @Body() updateSubscriptionDto: Partial<CreateSubscriptionDto>,
  ) {
    const subscription = await this.adminService.updateSubscription(
      userId,
      updateSubscriptionDto,
    );

    return {
      message: "Subscription updated successfully",
      subscription,
    };
  }

  /**
   * Grant geo access to user
   */
  @Post("users/:id/geo-access")
  async grantGeoAccess(
    @Param("id", ParseIntPipe) userId: number,
    @Body() grantGeoAccessDto: GrantGeoAccessDto,
  ) {
    const access = await this.adminService.grantGeoAccess(
      userId,
      grantGeoAccessDto,
    );

    return {
      message: "Geo access granted successfully",
      access,
    };
  }

  /**
   * Get user's geo access
   */
  @Get("users/:id/geo-access")
  async getUserGeoAccess(@Param("id", ParseIntPipe) userId: number) {
    const access = await this.adminService.getUserGeoAccess(userId);

    return {
      access,
      total: access.length,
    };
  }

  /**
   * Start impersonation
   */
  @Post("impersonate")
  async startImpersonation(
    @Body() impersonateDto: ImpersonateDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const adminId = req.user.id;
    const deviceInfo = req.headers["user-agent"];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const impersonationToken =
      await this.impersonationService.startImpersonation(
        adminId,
        impersonateDto,
        deviceInfo,
        ipAddress,
      );

    // Set impersonation token as cookie
    res.cookie("impersonationToken", impersonationToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 4 * 60 * 60 * 1000, // 4 hours
    });

    // Get target user details
    const targetUser = await this.adminService.getUserDetails(
      impersonateDto.targetUserId,
    );

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

  /**
   * Stop impersonation
   */
  @Post("stop-impersonation")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ImpersonationGuard)
  async stopImpersonation(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const impersonationToken = req.impersonationToken;

    await this.impersonationService.stopImpersonation(
      impersonationToken,
      "EXPLICIT_STOP",
    );

    // Clear cookie
    res.clearCookie("impersonationToken");

    return {
      message: "Impersonation stopped",
    };
  }

  /**
   * Get active impersonations
   */
  @Get("impersonations/active")
  async getActiveImpersonations(
    @Req() req: any,
    @Query("adminId") adminId?: string,
  ) {
    const requestingAdminId = req.user.id;
    const filterAdminId = adminId ? parseInt(adminId) : requestingAdminId;

    const impersonations =
      await this.impersonationService.getActiveImpersonations(filterAdminId);

    return {
      impersonations,
      total: impersonations.length,
    };
  }

  /**
   * Get impersonation history (audit log)
   */
  @Get("impersonations/history")
  async getImpersonationHistory(
    @Req() req: any,
    @Query("adminId") adminId?: string,
    @Query("limit") limit?: string,
  ) {
    const filterAdminId = adminId ? parseInt(adminId) : undefined;
    const limitNum = limit ? parseInt(limit) : 100;

    const history = await this.impersonationService.getImpersonationHistory(
      filterAdminId,
      limitNum,
    );

    return {
      history,
      total: history.length,
    };
  }
}

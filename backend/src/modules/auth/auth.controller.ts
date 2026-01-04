import { Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { LoginDto } from './dto';
import { Request, Response } from 'express';
import { SessionGuard } from './guards/session.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordService: PasswordService
  ) { }

  /**
   * Login with email/phone + password
   * Returns session token as HttpOnly cookie
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    // Extract device info and IP
    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const { user, sessionToken } = await this.authService.login(
      loginDto,
      deviceInfo,
      ipAddress
    );

    // Set session token as HttpOnly cookie
    res.cookie('sessionToken', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 9 * 24 * 60 * 60 * 1000, // 9 days
    });

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isTrial: user.isTrial,
      },
    };
  }

  /**
   * Logout - destroy session
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const sessionToken = req.sessionToken;

    if (sessionToken) {
      await this.authService.logout(sessionToken);
    }

    // Clear cookie
    res.clearCookie('sessionToken');

    return {
      message: 'Logout successful',
    };
  }

  /**
   * Get current authenticated user
   */
  @Get('me')
  @UseGuards(SessionGuard)
  async getCurrentUser(@Req() req: any) {
    const user = req.user;

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isTrial: user.isTrial,
        isActive: user.isActive,
        subscription: user.subscription,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Refresh session (update lastActivityAt)
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async refreshSession(@Req() req: any) {
    // Session is already validated and lastActivityAt updated by SessionGuard
    return {
      message: 'Session refreshed',
      expiresIn: '9 days',
    };
  }

  /**
   * Change password (requires current password)
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async changePassword(@Req() req: any, @Body() changePasswordDto: any) {
    const userId = req.user.id;
    await this.passwordService.changePassword(userId, changePasswordDto);

    return {
      message: 'Password changed successfully. Please login again with your new password.',
    };
  }

  /**
   * Forgot password - Send OTP to email
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: any) {
    const result = await this.passwordService.forgotPassword(forgotPasswordDto);
    return result;
  }

  /**
   * Reset password with OTP
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: any) {
    await this.passwordService.resetPassword(resetPasswordDto);

    return {
      message: 'Password reset successfully. You can now login with your new password.',
    };
  }
}

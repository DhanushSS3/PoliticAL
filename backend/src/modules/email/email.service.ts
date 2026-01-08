import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpHost = this.configService.get<string>("SMTP_HOST");
    const smtpPort = this.configService.get<number>("SMTP_PORT");
    const smtpUser = this.configService.get<string>("SMTP_USER");
    const smtpPass = this.configService.get<string>("SMTP_PASS");

    if (!smtpHost || !smtpUser || !smtpPass) {
      this.logger.warn(
        "SMTP configuration not found. Email service will not work.",
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort || 587,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    this.logger.log("Email service initialized");
  }

  /**
   * Send account creation email with credentials
   */
  async sendAccountCreatedEmail(
    email: string,
    fullName: string,
    emailOrPhone: string,
    tempPassword: string,
    isTrial: boolean = false,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn("Email not sent: SMTP not configured");
      return;
    }

    const fromEmail =
      this.configService.get<string>("FROM_EMAIL") || "noreply@politicai.com";
    const fromName =
      this.configService.get<string>("FROM_NAME") || "PoliticAI Platform";

    const subject = "Welcome to PoliticAI - Your Account Has Been Created";
    const html = this.getAccountCreatedTemplate(
      fullName,
      emailOrPhone,
      tempPassword,
      isTrial,
    );

    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject,
        html,
      });

      this.logger.log(`Account creation email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}:`, error);
      // Don't throw error - email failure shouldn't block user creation
    }
  }

  /**
   * Account creation email template
   */
  private getAccountCreatedTemplate(
    fullName: string,
    emailOrPhone: string,
    tempPassword: string,
    isTrial: boolean,
  ): string {
    const trialBadge = isTrial
      ? '<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px;"><strong>Trial Account</strong>: Your trial period is 1 day. Contact your administrator for a full subscription.</div>'
      : "";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to PoliticAI</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 40px 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Welcome to PoliticAI</h1>
              <p style="margin: 10px 0 0; color: #e0e7ff; font-size: 16px;">Your account has been created</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Hello <strong>${fullName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Your PoliticAI account has been successfully created by an administrator. You can now access the platform using the credentials below:
              </p>
              
              ${trialBadge}
              
              <!-- Credentials Box -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 24px; margin: 24px 0;">
                <h3 style="margin: 0 0 16px; color: #111827; font-size: 18px; font-weight: 600;">Login Credentials</h3>
                
                <div style="margin-bottom: 12px;">
                  <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">Email/Phone:</span>
                  <code style="background-color: #ffffff; border: 1px solid #d1d5db; padding: 8px 12px; border-radius: 4px; display: inline-block; font-family: 'Courier New', monospace; font-size: 14px; color: #111827;">${emailOrPhone}</code>
                </div>
                
                <div>
                  <span style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 4px;">Temporary Password:</span>
                  <code style="background-color: #ffffff; border: 1px solid #d1d5db; padding: 8px 12px; border-radius: 4px; display: inline-block; font-family: 'Courier New', monospace; font-size: 14px; color: #111827;">${tempPassword}</code>
                </div>
              </div>
              
              <!-- Security Note -->
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
                  <strong>⚠️ Security Recommendation:</strong><br>
                  We recommend changing your password after your first login for security purposes.
                </p>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="https://app.politicai.com/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Login to PoliticAI
                </a>
              </div>
              
              <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                If you have any questions or need assistance, please contact your administrator.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center; line-height: 1.6;">
                © ${new Date().getFullYear()} PoliticAI Platform. All rights reserved.<br>
                This is an automated message, please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log("SMTP connection verified");
      return true;
    } catch (error) {
      this.logger.error("SMTP connection failed:", error);
      return false;
    }
  }

  /**
   * Send password reset OTP
   */
  async sendPasswordResetOtp(
    email: string,
    fullName: string,
    otp: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn("Email not sent: SMTP not configured");
      return;
    }

    const fromEmail =
      this.configService.get<string>("FROM_EMAIL") || "noreply@politicai.com";
    const fromName =
      this.configService.get<string>("FROM_NAME") || "PoliticAI Platform";

    const subject = "Password Reset OTP - PoliticAI";
    const html = this.getPasswordResetOtpTemplate(fullName, otp);

    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject,
        html,
      });

      this.logger.log(`Password reset OTP sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${email}:`, error);
    }
  }

  /**
   * Send password changed notification
   */
  async sendPasswordChangedEmail(
    email: string,
    fullName: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn("Email not sent: SMTP not configured");
      return;
    }

    const fromEmail =
      this.configService.get<string>("FROM_EMAIL") || "noreply@politicai.com";
    const fromName =
      this.configService.get<string>("FROM_NAME") || "PoliticAI Platform";

    const subject = "Password Changed - PoliticAI";
    const html = this.getPasswordChangedTemplate(fullName);

    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject,
        html,
      });

      this.logger.log(`Password changed notification sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password changed email to ${email}:`,
        error,
      );
    }
  }

  /**
   * Send password reset confirmation
   */
  async sendPasswordResetConfirmation(
    email: string,
    fullName: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn("Email not sent: SMTP not configured");
      return;
    }

    const fromEmail =
      this.configService.get<string>("FROM_EMAIL") || "noreply@politicai.com";
    const fromName =
      this.configService.get<string>("FROM_NAME") || "PoliticAI Platform";

    const subject = "Password Reset Successful - PoliticAI";
    const html = this.getPasswordResetConfirmationTemplate(fullName);

    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject,
        html,
      });

      this.logger.log(`Password reset confirmation sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset confirmation to ${email}:`,
        error,
      );
    }
  }

  /**
   * Password reset OTP email template
   */
  private getPasswordResetOtpTemplate(fullName: string, otp: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset OTP</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Password Reset</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Hello <strong>${fullName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. Use the OTP below to reset your password:
              </p>
              
              <!-- OTP Box -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 30px; margin: 30px 0; text-align: center;">
                <p style="margin: 0 0 10px; color: #e0e7ff; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your OTP</p>
                <p style="margin: 0; color: #ffffff; font-size: 48px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</p>
              </div>
              
              <!-- Warning -->
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
                  <strong>⚠️ Important:</strong><br>
                  • This OTP is valid for <strong>10 minutes</strong><br>
                  • Do not share this OTP with anyone<br>
                  • If you didn't request this, please ignore this email
                </p>
              </div>
              
              <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                If you have any questions, please contact your administrator.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center; line-height: 1.6;">
                © ${new Date().getFullYear()} PoliticAI Platform. All rights reserved.<br>
                This is an automated message, please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Password changed notification template
   */
  private getPasswordChangedTemplate(fullName: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">✓ Password Changed</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Hello <strong>${fullName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Your password has been successfully changed.
              </p>
              
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
                  <strong>⚠️ Security Alert:</strong><br>
                  If you did not make this change, please contact your administrator immediately.
                </p>
              </div>
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center; line-height: 1.6;">
                © ${new Date().getFullYear()} PoliticAI Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Password reset confirmation template
   */
  private getPasswordResetConfirmationTemplate(fullName: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Successful</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">✓ Password Reset Successful</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Hello <strong>${fullName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Your password has been successfully reset. You can now login with your new password.
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="https://app.politicai.com/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Login to PoliticAI
                </a>
              </div>
              
              <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
                  <strong>⚠️ Security Alert:</strong><br>
                  If you did not reset your password, please contact your administrator immediately.
                </p>
              </div>
            </td>
          </tr>
          
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center; line-height: 1.6;">
                © ${new Date().getFullYear()} PoliticAI Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }
}

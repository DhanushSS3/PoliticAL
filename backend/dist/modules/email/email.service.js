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
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = require("nodemailer");
const config_1 = require("@nestjs/config");
let EmailService = EmailService_1 = class EmailService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(EmailService_1.name);
        this.initializeTransporter();
    }
    initializeTransporter() {
        const smtpHost = this.configService.get('SMTP_HOST');
        const smtpPort = this.configService.get('SMTP_PORT');
        const smtpUser = this.configService.get('SMTP_USER');
        const smtpPass = this.configService.get('SMTP_PASS');
        if (!smtpHost || !smtpUser || !smtpPass) {
            this.logger.warn('SMTP configuration not found. Email service will not work.');
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
        this.logger.log('Email service initialized');
    }
    async sendAccountCreatedEmail(email, fullName, emailOrPhone, tempPassword, isTrial = false) {
        if (!this.transporter) {
            this.logger.warn('Email not sent: SMTP not configured');
            return;
        }
        const fromEmail = this.configService.get('FROM_EMAIL') || 'noreply@politicai.com';
        const fromName = this.configService.get('FROM_NAME') || 'PoliticAI Platform';
        const subject = 'Welcome to PoliticAI - Your Account Has Been Created';
        const html = this.getAccountCreatedTemplate(fullName, emailOrPhone, tempPassword, isTrial);
        try {
            await this.transporter.sendMail({
                from: `"${fromName}" <${fromEmail}>`,
                to: email,
                subject,
                html,
            });
            this.logger.log(`Account creation email sent to ${email}`);
        }
        catch (error) {
            this.logger.error(`Failed to send email to ${email}:`, error);
        }
    }
    getAccountCreatedTemplate(fullName, emailOrPhone, tempPassword, isTrial) {
        const trialBadge = isTrial
            ? '<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px;"><strong>Trial Account</strong>: Your trial period is 1 day. Contact your administrator for a full subscription.</div>'
            : '';
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
    async testConnection() {
        if (!this.transporter) {
            return false;
        }
        try {
            await this.transporter.verify();
            this.logger.log('SMTP connection verified');
            return true;
        }
        catch (error) {
            this.logger.error('SMTP connection failed:', error);
            return false;
        }
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EmailService);
//# sourceMappingURL=email.service.js.map
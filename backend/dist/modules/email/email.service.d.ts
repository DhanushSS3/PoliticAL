import { ConfigService } from "@nestjs/config";
export declare class EmailService {
    private configService;
    private readonly logger;
    private transporter;
    constructor(configService: ConfigService);
    private initializeTransporter;
    sendAccountCreatedEmail(email: string, fullName: string, emailOrPhone: string, tempPassword: string, isTrial?: boolean): Promise<void>;
    private getAccountCreatedTemplate;
    testConnection(): Promise<boolean>;
    sendPasswordResetOtp(email: string, fullName: string, otp: string): Promise<void>;
    sendPasswordChangedEmail(email: string, fullName: string): Promise<void>;
    sendPasswordResetConfirmation(email: string, fullName: string): Promise<void>;
    private getPasswordResetOtpTemplate;
    private getPasswordChangedTemplate;
    private getPasswordResetConfirmationTemplate;
}

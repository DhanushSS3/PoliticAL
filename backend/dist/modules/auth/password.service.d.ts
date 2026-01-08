import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "./auth.service";
import { OtpService } from "./otp.service";
import { EmailService } from "../email/email.service";
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from "./dto/password.dto";
export declare class PasswordService {
    private prisma;
    private authService;
    private otpService;
    private emailService;
    constructor(prisma: PrismaService, authService: AuthService, otpService: OtpService, emailService: EmailService);
    changePassword(userId: number, dto: ChangePasswordDto): Promise<void>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<void>;
    private validatePassword;
}

import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { LoginDto } from "./dto";
import { Request, Response } from "express";
export declare class AuthController {
    private readonly authService;
    private readonly passwordService;
    constructor(authService: AuthService, passwordService: PasswordService);
    login(loginDto: LoginDto, req: Request, res: Response): Promise<{
        message: string;
        user: {
            id: any;
            fullName: any;
            email: any;
            phone: any;
            role: any;
            isTrial: any;
        };
    }>;
    logout(req: any, res: Response): Promise<{
        message: string;
    }>;
    getCurrentUser(req: any): Promise<{
        user: {
            id: any;
            fullName: any;
            email: any;
            phone: any;
            role: any;
            isTrial: any;
            isActive: any;
            subscription: any;
            createdAt: any;
        };
    }>;
    refreshSession(req: any): Promise<{
        message: string;
        expiresIn: string;
    }>;
    changePassword(req: any, changePasswordDto: any): Promise<{
        message: string;
    }>;
    forgotPassword(forgotPasswordDto: any): Promise<{
        message: string;
    }>;
    resetPassword(resetPasswordDto: any): Promise<{
        message: string;
    }>;
}

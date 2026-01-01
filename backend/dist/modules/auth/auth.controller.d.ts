import { AuthService } from './auth.service';
import { LoginDto } from './dto';
import { Request, Response } from 'express';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
}

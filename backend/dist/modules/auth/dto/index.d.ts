export declare class CreateUserDto {
    fullName: string;
    email?: string;
    phone: string;
    password?: string;
    role: 'ADMIN' | 'SUBSCRIBER';
    subscription?: {
        isTrial: boolean;
        durationDays?: number;
        geoUnitIds: number[];
    };
}
export declare class LoginDto {
    emailOrPhone: string;
    password: string;
}
export declare class CreateSessionDto {
    userId: number;
    deviceInfo?: string;
    ipAddress?: string;
}
export declare class ImpersonateDto {
    targetUserId: number;
    reason?: string;
}

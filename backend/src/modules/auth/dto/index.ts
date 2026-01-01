export class CreateUserDto {
    // User Details
    fullName: string;
    email?: string;
    phone: string;
    password?: string; // Optional: auto-generate if not provided
    role: 'ADMIN' | 'SUBSCRIBER';

    // Subscription Details (optional for ADMIN, required for SUBSCRIBER)
    subscription?: {
        isTrial: boolean;
        durationDays?: number; // If not provided, uses TRIAL_DURATION_DAYS or null (lifetime)
        geoUnitIds: number[]; // Required: which constituencies/districts user can access
    };
}

export class LoginDto {
    emailOrPhone: string;
    password: string;
}

export class CreateSessionDto {
    userId: number;
    deviceInfo?: string;
    ipAddress?: string;
}

export class ImpersonateDto {
    targetUserId: number;
    reason?: string;
}

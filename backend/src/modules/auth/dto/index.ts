export class CreateUserDto {
    // User Details
    fullName: string;
    email?: string;
    phone: string;
    password?: string; // Optional: auto-generate if not provided (industry standard)
    role: 'ADMIN' | 'SUBSCRIBER';

    // Subscription Details (REQUIRED for SUBSCRIBER)
    subscription?: {
        isTrial: boolean;

        // Duration is REQUIRED (admin must explicitly set expiry)
        // - For trial: typically 1-30 days
        // - For paid: 30, 90, 180, 365 days or custom
        // - For lifetime: set to 36500 (100 years) or use null
        durationDays: number | null; // null = lifetime, number = specific days

        // Geo access (REQUIRED)
        // Parent geo units automatically include all children
        // Example: If you grant access to "Karnataka" (STATE), 
        //          user gets access to all districts and constituencies in Karnataka
        geoUnitIds: number[];
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

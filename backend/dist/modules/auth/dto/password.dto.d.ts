export declare class ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
export declare class ForgotPasswordDto {
    emailOrPhone: string;
}
export declare class VerifyOtpDto {
    emailOrPhone: string;
    otp: string;
}
export declare class ResetPasswordDto {
    emailOrPhone: string;
    otp: string;
    newPassword: string;
}

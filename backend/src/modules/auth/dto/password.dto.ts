export class ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export class ForgotPasswordDto {
  emailOrPhone: string; // Can use email or phone
}

export class VerifyOtpDto {
  emailOrPhone: string;
  otp: string;
}

export class ResetPasswordDto {
  emailOrPhone: string;
  otp: string;
  newPassword: string;
}

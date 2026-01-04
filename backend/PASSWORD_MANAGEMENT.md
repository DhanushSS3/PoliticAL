# Password Management System

## Overview

A secure password management system following industry standard practices (OWASP, NIST).

## Features

### 1. Password Reset (Forgot Password)
- **Flow**: Request -> Email OTP -> Verify OTP & Reset Password
- **Security**:
  - 6-digit cryptographic OTP
  - 10-minute expiry
  - Rate limiting (max 3 attempts)
  - One-time use (new OTP invalidates old one)
  - Generic error messages (prevent user enumeration)

### 2. Change Password
- **Requirement**: Must provide current password
- **Validation**: New password cannot be same as old validation
- **Session Management**: All active sessions are invalidated upon password change (forces re-login)
- **Notification**: Email sent on successful change

### 3. OTP System
- **Storage**: Database (Prisma `PasswordResetOtp` model)
- **Cleanup**: Auto-expiry logic

## API Endpoints

### 1. Forgot Password
**POST** `/api/auth/forgot-password`
```json
{
  "emailOrPhone": "user@example.com"
}
```
**Response**: Generic success message (even if user not found)

### 2. Reset Password
**POST** `/api/auth/reset-password`
```json
{
  "emailOrPhone": "user@example.com",
  "otp": "123456",
  "newPassword": "NewSecurePassword123"
}
```

### 3. Change Password
**POST** `/api/auth/change-password` (Requires Login)
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewSecurePassword123"
}
```

## Security Implementation Details

### Rate Limiting
The `OtpService` tracks attempts. After 3 failed attempts, the OTP is invalidated and the user must request a new one.

### Session Invalidation
When a password is changed or reset, `AuthService.invalidateAllUserSessions(userId)` is called. This deletes all active sessions from the database, ensuring that if an account was compromised, the attacker is logged out immediately.

### Email Notifications
- **OTP Email**: Contains the code and validity duration warning.
- **Confirmation Email**: Sent after successful reset.
- **Change Notification**: Sent when password is changed while logged in.

## Usage Example

### Forgot Password Flow

1. User clicks "Forgot Password"
2. Enters email `john@example.com`
3. API generates OTP `582910` and sends email
4. User enters OTP and new password
5. API verifies:
   - OTP matches
   - OTP not expired (< 10 mins)
   - Attempts < 3
6. API updates password hash
7. API invalidates all sessions
8. User must login with new password

### Change Password Flow

1. User goes to Profile -> Change Password
2. Enters old password and new password
3. API verifies old password matches hash
4. API checks new != old
5. API updates password hash
6. API invalidates all sessions
7. User is logged out and must login again

## Database Schema

```prisma
model PasswordResetOtp {
  id        String   @id @default(uuid())
  userId    Int
  otp       String   // 6-digit OTP
  attempts  Int      @default(0)
  createdAt DateTime @default(now())
  expiresAt DateTime
  user      User     @relation(...)
}
```

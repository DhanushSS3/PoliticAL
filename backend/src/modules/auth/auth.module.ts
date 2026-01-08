import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { ImpersonationService } from "./impersonation.service";
import { PasswordService } from "./password.service";
import { OtpService } from "./otp.service";
import { SessionGuard } from "./guards/session.guard";
import { ImpersonationGuard } from "./guards/impersonation.guard";
import { RolesGuard } from "./guards/roles.guard";
import { UsersModule } from "../users/users.module";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [UsersModule, EmailModule],
  providers: [
    AuthService,
    ImpersonationService,
    PasswordService,
    OtpService,
    SessionGuard,
    ImpersonationGuard,
    RolesGuard,
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    ImpersonationService,
    PasswordService,
    OtpService,
    SessionGuard,
    ImpersonationGuard,
    RolesGuard,
  ],
})
export class AuthModule {}

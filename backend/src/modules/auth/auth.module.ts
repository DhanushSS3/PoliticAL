import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ImpersonationService } from './impersonation.service';
import { SessionGuard } from './guards/session.guard';
import { ImpersonationGuard } from './guards/impersonation.guard';
import { RolesGuard } from './guards/roles.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [
    AuthService,
    ImpersonationService,
    SessionGuard,
    ImpersonationGuard,
    RolesGuard
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    ImpersonationService,
    SessionGuard,
    ImpersonationGuard,
    RolesGuard
  ],
})
export class AuthModule {}

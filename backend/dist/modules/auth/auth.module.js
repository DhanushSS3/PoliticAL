"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const impersonation_service_1 = require("./impersonation.service");
const password_service_1 = require("./password.service");
const otp_service_1 = require("./otp.service");
const session_guard_1 = require("./guards/session.guard");
const impersonation_guard_1 = require("./guards/impersonation.guard");
const roles_guard_1 = require("./guards/roles.guard");
const users_module_1 = require("../users/users.module");
const email_module_1 = require("../email/email.module");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [users_module_1.UsersModule, email_module_1.EmailModule],
        providers: [
            auth_service_1.AuthService,
            impersonation_service_1.ImpersonationService,
            password_service_1.PasswordService,
            otp_service_1.OtpService,
            session_guard_1.SessionGuard,
            impersonation_guard_1.ImpersonationGuard,
            roles_guard_1.RolesGuard,
        ],
        controllers: [auth_controller_1.AuthController],
        exports: [
            auth_service_1.AuthService,
            impersonation_service_1.ImpersonationService,
            password_service_1.PasswordService,
            otp_service_1.OtpService,
            session_guard_1.SessionGuard,
            impersonation_guard_1.ImpersonationGuard,
            roles_guard_1.RolesGuard,
        ],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map
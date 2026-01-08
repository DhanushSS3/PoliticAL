"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImpersonationGuard = void 0;
const common_1 = require("@nestjs/common");
const impersonation_service_1 = require("../impersonation.service");
let ImpersonationGuard = class ImpersonationGuard {
    constructor(impersonationService) {
        this.impersonationService = impersonationService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const impersonationToken = this.extractImpersonationToken(request);
        if (!impersonationToken) {
            throw new common_1.UnauthorizedException("No impersonation token provided");
        }
        const session = await this.impersonationService.validateImpersonation(impersonationToken);
        if (!session) {
            throw new common_1.UnauthorizedException("Invalid or expired impersonation session");
        }
        request.admin = session.admin;
        request.user = session.targetUser;
        request.impersonationToken = impersonationToken;
        request.isImpersonating = true;
        return true;
    }
    extractImpersonationToken(request) {
        if (request.cookies && request.cookies.impersonationToken) {
            return request.cookies.impersonationToken;
        }
        const impersonationHeader = request.headers["x-impersonation-token"];
        if (impersonationHeader) {
            return impersonationHeader;
        }
        return null;
    }
};
exports.ImpersonationGuard = ImpersonationGuard;
exports.ImpersonationGuard = ImpersonationGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [impersonation_service_1.ImpersonationService])
], ImpersonationGuard);
//# sourceMappingURL=impersonation.guard.js.map
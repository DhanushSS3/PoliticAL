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
exports.GeoAccessGuard = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
let GeoAccessGuard = class GeoAccessGuard {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            throw new common_1.ForbiddenException('User not authenticated');
        }
        if (user.role === 'ADMIN') {
            return true;
        }
        const geoUnitId = request.query.geoUnitId;
        if (!geoUnitId) {
            return true;
        }
        let resolvedGeoUnitId;
        if (!isNaN(Number(geoUnitId))) {
            resolvedGeoUnitId = Number(geoUnitId);
        }
        else {
            const geoUnit = await this.prisma.geoUnit.findFirst({
                where: {
                    OR: [
                        { name: { contains: geoUnitId, mode: 'insensitive' } },
                        { code: { contains: geoUnitId, mode: 'insensitive' } }
                    ]
                },
                select: { id: true }
            });
            if (!geoUnit) {
                throw new common_1.ForbiddenException('GeoUnit not found');
            }
            resolvedGeoUnitId = geoUnit.id;
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId: user.id },
            include: {
                access: {
                    where: { geoUnitId: resolvedGeoUnitId }
                }
            }
        });
        if (!subscription || subscription.access.length === 0) {
            throw new common_1.ForbiddenException('You do not have access to this constituency. Please upgrade your subscription.');
        }
        request.resolvedGeoUnitId = resolvedGeoUnitId;
        return true;
    }
};
exports.GeoAccessGuard = GeoAccessGuard;
exports.GeoAccessGuard = GeoAccessGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GeoAccessGuard);
//# sourceMappingURL=geo-access.guard.js.map
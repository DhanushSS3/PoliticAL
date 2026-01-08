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
exports.GeoHierarchyService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let GeoHierarchyService = class GeoHierarchyService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async expandGeoUnitsWithChildren(geoUnitIds) {
        const allGeoUnits = new Set();
        for (const geoUnitId of geoUnitIds) {
            allGeoUnits.add(geoUnitId);
            const descendants = await this.getDescendants(geoUnitId);
            descendants.forEach((id) => allGeoUnits.add(id));
        }
        return Array.from(allGeoUnits);
    }
    async getDescendants(geoUnitId) {
        const descendants = [];
        const children = await this.prisma.geoUnit.findMany({
            where: { parentId: geoUnitId },
            select: { id: true },
        });
        for (const child of children) {
            descendants.push(child.id);
            const childDescendants = await this.getDescendants(child.id);
            descendants.push(...childDescendants);
        }
        return descendants;
    }
    async getGeoUnitHierarchy(geoUnitId) {
        return this.prisma.geoUnit.findUnique({
            where: { id: geoUnitId },
            include: {
                children: {
                    include: {
                        children: {
                            include: {
                                children: true,
                            },
                        },
                    },
                },
            },
        });
    }
    async validateGeoUnits(geoUnitIds) {
        const geoUnits = await this.prisma.geoUnit.findMany({
            where: { id: { in: geoUnitIds } },
            select: { id: true },
        });
        const foundIds = geoUnits.map((g) => g.id);
        const missingIds = geoUnitIds.filter((id) => !foundIds.includes(id));
        if (missingIds.length > 0) {
            throw new common_1.BadRequestException(`Invalid geo unit IDs: ${missingIds.join(", ")}`);
        }
    }
};
exports.GeoHierarchyService = GeoHierarchyService;
exports.GeoHierarchyService = GeoHierarchyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GeoHierarchyService);
//# sourceMappingURL=geo-hierarchy.service.js.map
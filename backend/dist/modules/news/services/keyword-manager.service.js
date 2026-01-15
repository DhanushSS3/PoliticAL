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
var KeywordManagerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeywordManagerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const client_1 = require("@prisma/client");
let KeywordManagerService = KeywordManagerService_1 = class KeywordManagerService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(KeywordManagerService_1.name);
    }
    async seedKeywordsForEntity(entityType, entityId, name) {
        const keywords = this.generateBaseKeywords(entityType, name);
        for (const keyword of keywords) {
            try {
                await this.prisma.newsKeyword.create({
                    data: {
                        keyword,
                        entityType,
                        entityId,
                        isActive: true,
                        priority: 1,
                    },
                });
            }
            catch (error) {
                if (error.code !== "P2002") {
                    this.logger.error(`Failed to seed keyword "${keyword}": ${error.message}`);
                }
            }
        }
    }
    async buildSearchQuery(entityType, entityId) {
        const keywords = await this.prisma.newsKeyword.findMany({
            where: {
                entityType,
                entityId,
                isActive: true,
            },
            select: { keyword: true },
        });
        if (keywords.length === 0) {
            return null;
        }
        const entityClause = keywords.map((k) => `"${k.keyword}"`).join(" OR ");
        const contextTerms = [
            "election",
            "polls",
            "vote",
            "campaign",
            "protest",
            "policy",
            "government",
            "scandal",
            "development",
            "constituency",
        ];
        const contextClause = contextTerms.join(" OR ");
        return `(${entityClause}) AND (${contextClause})`;
    }
    async addKeyword(entityType, entityId, keyword, priority = 5) {
        return this.prisma.newsKeyword.create({
            data: {
                keyword,
                entityType,
                entityId,
                isActive: true,
                priority,
            },
        });
    }
    generateBaseKeywords(entityType, name) {
        const keywords = [name];
        if (entityType === client_1.EntityType.CANDIDATE) {
            if (!name.toLowerCase().includes("karnataka")) {
                keywords.push(`${name} Karnataka`);
            }
        }
        else if (entityType === client_1.EntityType.PARTY) {
            keywords.push(`${name} Karnataka`);
        }
        return keywords;
    }
};
exports.KeywordManagerService = KeywordManagerService;
exports.KeywordManagerService = KeywordManagerService = KeywordManagerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], KeywordManagerService);
//# sourceMappingURL=keyword-manager.service.js.map
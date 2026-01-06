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
exports.NewsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const client_1 = require("@prisma/client");
let NewsService = class NewsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getNewsFeed(dto) {
        const { page = 1, limit = 20, geoUnitId, entityId, entityType, sentiment, search } = dto;
        const skip = (page - 1) * limit;
        const where = {
            status: client_1.ModerationStatus.APPROVED,
        };
        if (geoUnitId) {
            where.sentimentSignals = {
                some: {
                    geoUnitId: geoUnitId
                }
            };
        }
        if (entityId && entityType) {
            where.entityMentions = {
                some: {
                    entityId,
                    entityType
                }
            };
        }
        if (sentiment) {
            if (geoUnitId) {
                where.sentimentSignals = {
                    some: {
                        geoUnitId: geoUnitId,
                        sentiment: sentiment
                    }
                };
            }
            else {
                where.sentimentSignals = {
                    some: {
                        sentiment: sentiment
                    }
                };
            }
        }
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { summary: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [items, total] = await Promise.all([
            this.prisma.newsArticle.findMany({
                where,
                take: limit,
                skip,
                orderBy: { publishedAt: 'desc' },
                include: {
                    entityMentions: true,
                    sentimentSignals: true,
                }
            }),
            this.prisma.newsArticle.count({ where }),
        ]);
        return {
            data: items,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
};
exports.NewsService = NewsService;
exports.NewsService = NewsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NewsService);
//# sourceMappingURL=news.service.js.map
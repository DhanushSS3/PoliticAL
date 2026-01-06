import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetNewsFeedDto } from '../dto/get-news.dto';
import { ModerationStatus } from '@prisma/client';

@Injectable()
export class NewsService {
    constructor(private prisma: PrismaService) { }

    async getNewsFeed(dto: GetNewsFeedDto) {
        const { page = 1, limit = 20, geoUnitId, entityId, entityType, sentiment, search } = dto;
        const skip = (page - 1) * limit;

        const where: any = {
            status: ModerationStatus.APPROVED, // Only show approved news
        };

        // Geo Filter: Show articles that have sentiment signals linked to this GeoUnit by default
        // Or we could show articles where the entities mentioned belong to this GeoUnit (more complex query)
        // For v1: Filter by explicitly linked sentiment signals (which we created in ingestion)
        if (geoUnitId) {
            where.sentimentSignals = {
                some: {
                    geoUnitId: geoUnitId
                }
            };
        }

        // Entity Filter
        if (entityId && entityType) {
            where.entityMentions = {
                some: {
                    entityId,
                    entityType
                }
            };
        }

        // Sentiment Filter
        if (sentiment) {
            // If filtering by sentiment AND geo, we must ensure the signal IS for that geo and has that sentiment
            if (geoUnitId) {
                where.sentimentSignals = {
                    some: {
                        geoUnitId: geoUnitId,
                        sentiment: sentiment
                    }
                };
            } else {
                // Include article if ANY signal has this sentiment
                where.sentimentSignals = {
                    some: {
                        sentiment: sentiment
                    }
                };
            }
        }

        // Search
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
                    // We include signals to show the user the sentiment
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
}

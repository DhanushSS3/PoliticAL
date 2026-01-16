import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * GeoAccessGuard
 * 
 * Validates that the authenticated user has access to the requested geoUnit
 * via their subscription's GeoAccess records.
 * 
 * Usage: Apply to endpoints that accept geoUnitId query parameter
 * The guard will check if the user's subscription includes access to that geoUnit
 */
@Injectable()
export class GeoAccessGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        // Admin users have access to everything
        if (user.role === 'ADMIN') {
            return true;
        }

        // Extract geoUnitId from query params
        const geoUnitId = request.query.geoUnitId;

        // If no geoUnitId specified, allow (will be filtered by service)
        if (!geoUnitId) {
            return true;
        }

        // Resolve geoUnitId (could be name or ID)
        let resolvedGeoUnitId: number;

        if (!isNaN(Number(geoUnitId))) {
            resolvedGeoUnitId = Number(geoUnitId);
        } else {
            // Try to resolve by name
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
                throw new ForbiddenException('GeoUnit not found');
            }

            resolvedGeoUnitId = geoUnit.id;
        }

        // Check if user has subscription with access to this geoUnit
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId: user.id },
            include: {
                access: {
                    where: { geoUnitId: resolvedGeoUnitId }
                }
            }
        });

        if (!subscription || subscription.access.length === 0) {
            throw new ForbiddenException(
                'You do not have access to this constituency. Please upgrade your subscription.'
            );
        }

        // Store resolved geoUnitId for use in service
        request.resolvedGeoUnitId = resolvedGeoUnitId;

        return true;
    }
}

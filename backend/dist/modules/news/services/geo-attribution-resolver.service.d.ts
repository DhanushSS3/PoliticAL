import { PrismaService } from "../../../prisma/prisma.service";
import { EntityType } from "@prisma/client";
export declare class GeoAttributionResolverService {
    private readonly prisma;
    private readonly logger;
    private fallbackStateGeoUnitId;
    constructor(prisma: PrismaService);
    private initializeFallback;
    resolveGeoUnits(articleId: number): Promise<Array<{
        geoUnitId: number;
        sourceEntityType?: EntityType;
        sourceEntityId?: number;
    }>>;
    private getFallback;
}

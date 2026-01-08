import { PrismaService } from "../../prisma/prisma.service";
export declare class GeoHierarchyService {
    private prisma;
    constructor(prisma: PrismaService);
    expandGeoUnitsWithChildren(geoUnitIds: number[]): Promise<number[]>;
    private getDescendants;
    getGeoUnitHierarchy(geoUnitId: number): Promise<{
        children: ({
            children: ({
                children: {
                    name: string;
                    id: number;
                    createdAt: Date;
                    code: string | null;
                    level: import(".prisma/client").$Enums.GeoLevel;
                    parentId: number | null;
                }[];
            } & {
                name: string;
                id: number;
                createdAt: Date;
                code: string | null;
                level: import(".prisma/client").$Enums.GeoLevel;
                parentId: number | null;
            })[];
        } & {
            name: string;
            id: number;
            createdAt: Date;
            code: string | null;
            level: import(".prisma/client").$Enums.GeoLevel;
            parentId: number | null;
        })[];
    } & {
        name: string;
        id: number;
        createdAt: Date;
        code: string | null;
        level: import(".prisma/client").$Enums.GeoLevel;
        parentId: number | null;
    }>;
    validateGeoUnits(geoUnitIds: number[]): Promise<void>;
}

import { PrismaService } from "../../prisma/prisma.service";
export declare class ElectionsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: number;
        year: string;
        type: import(".prisma/client").$Enums.ElectionType;
        name: string;
    }[]>;
    getHealth(): string;
}

import { ElectionsService } from "./elections.service";
export declare class ElectionsController {
    private readonly electionsService;
    constructor(electionsService: ElectionsService);
    findAll(): Promise<{
        id: number;
        year: string;
        type: import(".prisma/client").$Enums.ElectionType;
        name: string;
    }[]>;
}

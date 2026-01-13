import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getSummary(electionId?: string, stateId?: string, someIntParam?: number): Promise<unknown>;
    getPartyStats(electionId: string): Promise<unknown>;
}

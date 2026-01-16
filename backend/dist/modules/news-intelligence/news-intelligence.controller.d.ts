import { NewsIntelligenceService } from './news-intelligence.service';
export declare class NewsIntelligenceController {
    private readonly newsIntelligenceService;
    constructor(newsIntelligenceService: NewsIntelligenceService);
    getProjectedWinner(req: any, geoUnitId?: string): Promise<unknown>;
    getControversies(req: any, geoUnitId?: string, days?: number, limit?: number): Promise<unknown>;
    getHeadToHead(req: any, candidate1Id: number, candidate2Id: number, days?: number): Promise<unknown>;
    getNewsImpact(req: any, geoUnitId?: string, days?: number): Promise<unknown>;
    getLiveFeed(req: any, geoUnitId?: string, partyId?: number, limit?: number): Promise<unknown>;
}

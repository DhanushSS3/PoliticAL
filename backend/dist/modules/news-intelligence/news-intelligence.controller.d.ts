import { NewsIntelligenceService } from './news-intelligence.service';
export declare class NewsIntelligenceController {
    private readonly newsIntelligenceService;
    constructor(newsIntelligenceService: NewsIntelligenceService);
    getProjectedWinner(geoUnitId: string): Promise<unknown>;
    getControversies(geoUnitId: string, days?: number, limit?: number): Promise<unknown>;
    getHeadToHead(candidate1Id: number, candidate2Id: number, days?: number): Promise<unknown>;
    getNewsImpact(geoUnitId: string, days?: number): Promise<unknown>;
    getLiveFeed(geoUnitId?: string, partyId?: number, limit?: number): Promise<unknown>;
}

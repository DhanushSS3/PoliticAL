import { Cache } from 'cache-manager';
export declare class CacheService {
    private cacheManager;
    constructor(cacheManager: Cache);
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any, ttl?: number): Promise<void>;
    del(key: string): Promise<void>;
    static getDashboardSummaryKey(electionId: string, stateId: string): string;
    static getPartyStatsKey(electionId: string): string;
    static getConstituencyMapKey(electionId: string): string;
}

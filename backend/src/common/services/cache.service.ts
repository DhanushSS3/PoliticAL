import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) { }

    async get<T>(key: string): Promise<T | null> {
        return this.cacheManager.get<T>(key);
    }

    async set(key: string, value: any, ttl?: number): Promise<void> {
        // Note: cache-manager v5+ might use milliseconds for TTL in some stores, 
        // but NestJS wrapper often normalizes. 
        // Redis store usually expects seconds or milliseconds depending on config.
        // For now passing ttl as is.
        await this.cacheManager.set(key, value, ttl);
    }

    async del(key: string): Promise<void> {
        await this.cacheManager.del(key);
    }

    // reset() is not supported in cache-manager v5+ interface directly without casting to store
    // Removing it as it's not currently used.

    // --- Dashboard Specific Key Generators ---

    static getDashboardSummaryKey(electionId: string, stateId: string): string {
        return `dashboard:summary:${electionId}:${stateId}`;
    }

    static getPartyStatsKey(electionId: string): string {
        return `dashboard:party_stats:${electionId}`;
    }

    static getConstituencyMapKey(electionId: string): string {
        return `constituencies:map:${electionId}`;
    }
}

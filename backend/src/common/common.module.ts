
import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import { CacheService } from './services/cache.service';

@Global()
@Module({
    imports: [
        CacheModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                store: redisStore,
                host: configService.get('REDIS_HOST', 'localhost'),
                port: configService.get('REDIS_PORT', 6379),
                ttl: 600, // Default 10 minutes
                isGlobal: true,
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [CacheService],
    exports: [CacheModule, CacheService],
})
export class CommonModule { }

import { Module } from '@nestjs/common';
import { ConstituenciesController } from './constituencies.controller';
import { ConstituenciesService } from './constituencies.service';

@Module({
    controllers: [ConstituenciesController],
    providers: [ConstituenciesService],
})
export class ConstituenciesModule { }

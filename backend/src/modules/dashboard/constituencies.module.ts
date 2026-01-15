import { Module } from '@nestjs/common';
import { ConstituenciesController } from './constituencies.controller';
import { ConstituenciesService } from './constituencies.service';
import { CandidateSettingsController } from './candidate-settings.controller';
import { CandidateSettingsService } from './candidate-settings.service';

@Module({
    controllers: [ConstituenciesController, CandidateSettingsController],
    providers: [ConstituenciesService, CandidateSettingsService],
    exports: [CandidateSettingsService], // Export in case other modules need it
})
export class ConstituenciesModule { }

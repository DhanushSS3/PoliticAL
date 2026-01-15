import { CandidateSettingsService } from './candidate-settings.service';
export declare class CandidateSettingsController {
    private readonly settingsService;
    constructor(settingsService: CandidateSettingsService);
    getSettings(candidateId: number): Promise<{
        candidateId: number;
        candidateName: string;
        constituency: {
            id: number;
            name: string;
            code: string;
        };
        party: {
            id: number;
            name: string;
            symbol: string;
        };
        profilePhotoPath: string;
        profileTextPath: string;
        opponent: {
            id: number;
            name: string;
            party: string;
            profilePhotoPath: string;
            profileTextPath: string;
        };
    }>;
    updateOpponent(candidateId: number, opponentId: number): Promise<{
        success: boolean;
        opponentId: number;
    }>;
    updateProfilePhoto(candidateId: number, photoPath: string): Promise<{
        success: boolean;
        photoPath: string;
    }>;
    updateProfileText(candidateId: number, textPath: string): Promise<{
        success: boolean;
        textPath: string;
    }>;
    updateOpponentProfilePhoto(candidateId: number, photoPath: string): Promise<{
        success: boolean;
        photoPath: string;
    }>;
    updateOpponentProfileText(candidateId: number, textPath: string): Promise<{
        success: boolean;
        textPath: string;
    }>;
}

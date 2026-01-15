"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandidateSettingsController = void 0;
const common_1 = require("@nestjs/common");
const candidate_settings_service_1 = require("./candidate-settings.service");
let CandidateSettingsController = class CandidateSettingsController {
    constructor(settingsService) {
        this.settingsService = settingsService;
    }
    async getSettings(candidateId) {
        return this.settingsService.getSettings(candidateId);
    }
    async updateOpponent(candidateId, opponentId) {
        return this.settingsService.updateOpponent(candidateId, opponentId);
    }
    async updateProfilePhoto(candidateId, photoPath) {
        return this.settingsService.updateProfilePhoto(candidateId, photoPath);
    }
    async updateProfileText(candidateId, textPath) {
        return this.settingsService.updateProfileText(candidateId, textPath);
    }
    async updateOpponentProfilePhoto(candidateId, photoPath) {
        return this.settingsService.updateOpponentProfilePhoto(candidateId, photoPath);
    }
    async updateOpponentProfileText(candidateId, textPath) {
        return this.settingsService.updateOpponentProfileText(candidateId, textPath);
    }
};
exports.CandidateSettingsController = CandidateSettingsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('candidateId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], CandidateSettingsController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Patch)('opponent'),
    __param(0, (0, common_1.Body)('candidateId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)('opponentId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], CandidateSettingsController.prototype, "updateOpponent", null);
__decorate([
    (0, common_1.Patch)('profile-photo'),
    __param(0, (0, common_1.Body)('candidateId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)('photoPath')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], CandidateSettingsController.prototype, "updateProfilePhoto", null);
__decorate([
    (0, common_1.Patch)('profile-text'),
    __param(0, (0, common_1.Body)('candidateId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)('textPath')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], CandidateSettingsController.prototype, "updateProfileText", null);
__decorate([
    (0, common_1.Patch)('opponent-photo'),
    __param(0, (0, common_1.Body)('candidateId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)('photoPath')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], CandidateSettingsController.prototype, "updateOpponentProfilePhoto", null);
__decorate([
    (0, common_1.Patch)('opponent-text'),
    __param(0, (0, common_1.Body)('candidateId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)('textPath')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], CandidateSettingsController.prototype, "updateOpponentProfileText", null);
exports.CandidateSettingsController = CandidateSettingsController = __decorate([
    (0, common_1.Controller)('v1/settings'),
    __metadata("design:paramtypes", [candidate_settings_service_1.CandidateSettingsService])
], CandidateSettingsController);
//# sourceMappingURL=candidate-settings.controller.js.map
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
exports.ConstituenciesController = void 0;
const common_1 = require("@nestjs/common");
const constituencies_service_1 = require("./constituencies.service");
let ConstituenciesController = class ConstituenciesController {
    constructor(constituenciesService) {
        this.constituenciesService = constituenciesService;
    }
    async getMapData(electionId, metric, level) {
        return this.constituenciesService.getMapData(electionId, metric, level);
    }
    async getSubscribed(userId) {
        return this.constituenciesService.getSubscribed(parseInt(userId));
    }
    async getDetails(constituencyId, electionId) {
        return this.constituenciesService.getConstituencyDetails(parseInt(constituencyId), electionId);
    }
    async getOpponents(constituencyId) {
        return this.constituenciesService.getOpponents(parseInt(constituencyId));
    }
    async getDistrictDetails(district, electionId) {
        return this.constituenciesService.getDistrictDetails(district, electionId);
    }
};
exports.ConstituenciesController = ConstituenciesController;
__decorate([
    (0, common_1.Get)('map-data'),
    __param(0, (0, common_1.Query)('electionId')),
    __param(1, (0, common_1.Query)('metric')),
    __param(2, (0, common_1.Query)('level')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ConstituenciesController.prototype, "getMapData", null);
__decorate([
    (0, common_1.Get)('subscribed'),
    __param(0, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConstituenciesController.prototype, "getSubscribed", null);
__decorate([
    (0, common_1.Get)('details'),
    __param(0, (0, common_1.Query)('constituencyId')),
    __param(1, (0, common_1.Query)('electionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConstituenciesController.prototype, "getDetails", null);
__decorate([
    (0, common_1.Get)('opponents'),
    __param(0, (0, common_1.Query)('constituencyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ConstituenciesController.prototype, "getOpponents", null);
__decorate([
    (0, common_1.Get)('district-details'),
    __param(0, (0, common_1.Query)('district')),
    __param(1, (0, common_1.Query)('electionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ConstituenciesController.prototype, "getDistrictDetails", null);
exports.ConstituenciesController = ConstituenciesController = __decorate([
    (0, common_1.Controller)('v1/constituencies'),
    __metadata("design:paramtypes", [constituencies_service_1.ConstituenciesService])
], ConstituenciesController);
//# sourceMappingURL=constituencies.controller.js.map
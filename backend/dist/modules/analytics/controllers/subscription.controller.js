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
exports.SubscriptionController = void 0;
const common_1 = require("@nestjs/common");
const monitoring_manager_service_1 = require("../services/monitoring-manager.service");
const create_candidate_dto_1 = require("../dto/create-candidate.dto");
let SubscriptionController = class SubscriptionController {
    constructor(monitoringManager) {
        this.monitoringManager = monitoringManager;
    }
    async activateMonitoring(body) {
        const result = await this.monitoringManager.activateMonitoring(body.candidateId, body.userId);
        return Object.assign({ success: true, message: `Monitoring activated for candidate #${body.candidateId}` }, result);
    }
    async deactivateMonitoring(candidateId) {
        await this.monitoringManager.deactivateMonitoring(candidateId);
        return {
            success: true,
            message: `Monitoring deactivated for candidate #${candidateId}`,
        };
    }
    async getActiveEntities() {
        const entities = await this.monitoringManager.getActiveEntities();
        return {
            total: entities.length,
            entities,
        };
    }
    async subscribeToGeoUnit(id) {
        await this.monitoringManager.activateGeoMonitoring(id);
        return {
            message: `Monitoring activated for GeoUnit #${id}`,
        };
    }
    async createCandidate(dto) {
        const result = await this.monitoringManager.createCandidate(dto.fullName, dto.partyId, dto.constituencyId, dto.age, dto.gender);
        return Object.assign({ success: true, message: "Candidate created successfully" }, result);
    }
};
exports.SubscriptionController = SubscriptionController;
__decorate([
    (0, common_1.Post)("activate"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "activateMonitoring", null);
__decorate([
    (0, common_1.Delete)(":candidateId"),
    __param(0, (0, common_1.Param)("candidateId", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "deactivateMonitoring", null);
__decorate([
    (0, common_1.Get)("active"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "getActiveEntities", null);
__decorate([
    (0, common_1.Post)("geounit/:id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "subscribeToGeoUnit", null);
__decorate([
    (0, common_1.Post)("candidates"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_candidate_dto_1.CreateCandidateDto]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "createCandidate", null);
exports.SubscriptionController = SubscriptionController = __decorate([
    (0, common_1.Controller)("admin/subscriptions"),
    __metadata("design:paramtypes", [monitoring_manager_service_1.MonitoringManagerService])
], SubscriptionController);
//# sourceMappingURL=subscription.controller.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const admin_controller_1 = require("./admin.controller");
const admin_service_1 = require("./admin.service");
const user_provisioning_service_1 = require("./user-provisioning.service");
const geo_hierarchy_service_1 = require("./geo-hierarchy.service");
const auth_module_1 = require("../auth/auth.module");
const email_module_1 = require("../email/email.module");
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, email_module_1.EmailModule],
        controllers: [admin_controller_1.AdminController],
        providers: [admin_service_1.AdminService, user_provisioning_service_1.UserProvisioningService, geo_hierarchy_service_1.GeoHierarchyService],
        exports: [admin_service_1.AdminService, user_provisioning_service_1.UserProvisioningService, geo_hierarchy_service_1.GeoHierarchyService],
    })
], AdminModule);
//# sourceMappingURL=admin.module.js.map
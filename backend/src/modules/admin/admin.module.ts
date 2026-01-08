import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { UserProvisioningService } from "./user-provisioning.service";
import { GeoHierarchyService } from "./geo-hierarchy.service";
import { AuthModule } from "../auth/auth.module";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [AdminController],
  providers: [AdminService, UserProvisioningService, GeoHierarchyService],
  exports: [AdminService, UserProvisioningService, GeoHierarchyService],
})
export class AdminModule {}

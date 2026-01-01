import { Module } from "@nestjs/common";
import { ElectionsService } from "./elections.service";
import { ElectionsController } from "./elections.controller";

@Module({
  providers: [ElectionsService],
  controllers: [ElectionsController],
  exports: [ElectionsService],
})
export class ElectionsModule {}

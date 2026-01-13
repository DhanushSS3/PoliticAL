import { Controller, Get } from "@nestjs/common";
import { ElectionsService } from "./elections.service";

@Controller("v1/elections")
export class ElectionsController {
  constructor(private readonly electionsService: ElectionsService) { }

  @Get()
  async findAll() {
    return this.electionsService.findAll();
  }
}

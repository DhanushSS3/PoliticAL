import { Controller } from "@nestjs/common";
import { ElectionsService } from "./elections.service";

@Controller("elections")
export class ElectionsController {
  constructor(private readonly electionsService: ElectionsService) {}
}

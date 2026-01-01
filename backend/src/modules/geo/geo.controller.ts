import { Controller, Get } from "@nestjs/common";
import { GeoService } from "./geo.service";

@Controller("geo")
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get("health")
  healthCheck() {
    return "Geo Service is up";
  }
}

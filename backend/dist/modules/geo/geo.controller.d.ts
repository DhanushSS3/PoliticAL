import { GeoService } from "./geo.service";
export declare class GeoController {
    private readonly geoService;
    constructor(geoService: GeoService);
    healthCheck(): string;
}

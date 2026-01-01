import { Injectable } from "@nestjs/common";

@Injectable()
export class ElectionsService {
  getHealth() {
    return "Elections Service is up";
  }
}

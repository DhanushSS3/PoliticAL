import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ElectionsService {
  constructor(private prisma: PrismaService) { }

  async findAll() {
    const elections = await this.prisma.election.findMany({
      orderBy: { year: 'desc' },
      select: {
        id: true,
        year: true,
        type: true,
      }
    });

    return elections.map(e => ({
      id: e.id,
      year: e.year.toString(),
      type: e.type,
      name: `${e.year} ${e.type}` // Synthesized name
    }));
  }

  getHealth() {
    return "Elections Service is up";
  }
}

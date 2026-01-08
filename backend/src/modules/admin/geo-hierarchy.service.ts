import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

/**
 * GeoHierarchyService
 *
 * Handles hierarchical geo unit access.
 * When a parent geo unit is granted, all children are automatically included.
 *
 * Example:
 * - Grant access to "Karnataka" (STATE) → includes all districts and constituencies
 * - Grant access to "Bangalore Urban" (DISTRICT) → includes all constituencies in that district
 */
@Injectable()
export class GeoHierarchyService {
  constructor(private prisma: PrismaService) {}

  /**
   * Expand geo unit IDs to include all descendants
   *
   * Industry pattern: AWS IAM resource hierarchy
   * - Grant access to /folder/* includes all subfolders and files
   * - Grant access to arn:aws:s3:::bucket/* includes all objects
   *
   * Our pattern:
   * - Grant access to STATE includes all DISTRICT and CONSTITUENCY
   * - Grant access to DISTRICT includes all CONSTITUENCY
   */
  async expandGeoUnitsWithChildren(geoUnitIds: number[]): Promise<number[]> {
    const allGeoUnits = new Set<number>();

    for (const geoUnitId of geoUnitIds) {
      // Add the geo unit itself
      allGeoUnits.add(geoUnitId);

      // Add all descendants (recursive)
      const descendants = await this.getDescendants(geoUnitId);
      descendants.forEach((id) => allGeoUnits.add(id));
    }

    return Array.from(allGeoUnits);
  }

  /**
   * Get all descendant geo units recursively
   */
  private async getDescendants(geoUnitId: number): Promise<number[]> {
    const descendants: number[] = [];

    // Get direct children
    const children = await this.prisma.geoUnit.findMany({
      where: { parentId: geoUnitId },
      select: { id: true },
    });

    for (const child of children) {
      descendants.push(child.id);

      // Recursively get children's descendants
      const childDescendants = await this.getDescendants(child.id);
      descendants.push(...childDescendants);
    }

    return descendants;
  }

  /**
   * Get geo unit hierarchy for display
   */
  async getGeoUnitHierarchy(geoUnitId: number) {
    return this.prisma.geoUnit.findUnique({
      where: { id: geoUnitId },
      include: {
        children: {
          include: {
            children: {
              include: {
                children: true, // Up to 3 levels deep
              },
            },
          },
        },
      },
    });
  }

  /**
   * Validate geo unit IDs exist
   */
  async validateGeoUnits(geoUnitIds: number[]): Promise<void> {
    const geoUnits = await this.prisma.geoUnit.findMany({
      where: { id: { in: geoUnitIds } },
      select: { id: true },
    });

    const foundIds = geoUnits.map((g) => g.id);
    const missingIds = geoUnitIds.filter((id) => !foundIds.includes(id));

    if (missingIds.length > 0) {
      throw new BadRequestException(
        `Invalid geo unit IDs: ${missingIds.join(", ")}`,
      );
    }
  }
}

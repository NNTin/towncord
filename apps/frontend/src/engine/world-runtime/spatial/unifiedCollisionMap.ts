import {
  worldToAnchoredGridCell,
  type AnchoredGridLayout,
  type AnchoredGridRegion,
} from "../regions/anchoredGridRegion";
import { doesFurnitureBlockMovement } from "./officeFurnitureRules";

export type RegionCellKind = "floor" | "wall" | "void";

export interface TerrainWalkabilitySurface {
  isWorldWalkable(worldX: number, worldY: number): boolean;
}

export interface AnchoredRegionCellLookup<
  TLayout extends AnchoredGridLayout = AnchoredGridLayout,
> extends AnchoredGridRegion<TLayout> {
  getCellKind(col: number, row: number): RegionCellKind | null;
}

export class UnifiedCollisionMap {
  constructor(
    private readonly terrain: TerrainWalkabilitySurface,
    private readonly region: AnchoredRegionCellLookup | null,
  ) {}

  public isWorldWalkable(worldX: number, worldY: number): boolean {
    const region = this.region;
    if (region) {
      const cell = worldToAnchoredGridCell(worldX, worldY, region);
      if (cell) {
        if (this.isFurnitureBlockingCell(region.layout, cell.col, cell.row)) {
          return false;
        }

        const kind = region.getCellKind(cell.col, cell.row);
        if (kind === "floor") return true;
        if (kind === "wall") return false;
        // kind === "void" or null: erased/empty cell falls through to terrain
      }
    }

    return this.terrain.isWorldWalkable(worldX, worldY);
  }

  private isFurnitureBlockingCell(
    layout: { furniture?: readonly { category: string; placement: string; col: number; row: number; width: number; height: number }[] },
    col: number,
    row: number,
  ): boolean {
    const furniture = layout.furniture;
    if (!furniture || furniture.length === 0) {
      return false;
    }

    for (const item of furniture) {
      if (!doesFurnitureBlockMovement(item)) {
        continue;
      }

      if (
        col >= item.col &&
        col < item.col + item.width &&
        row >= item.row &&
        row < item.row + item.height
      ) {
        return true;
      }
    }

    return false;
  }
}

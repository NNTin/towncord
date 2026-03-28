import {
  worldToAnchoredGridCell,
  type AnchoredGridLayout,
  type AnchoredGridRegion,
} from "../regions/anchoredGridRegion";

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
        const kind = region.getCellKind(cell.col, cell.row);
        if (kind === "floor") return true;
        if (kind === "wall") return false;
        // kind === "void" or null: erased/empty cell falls through to terrain
      }
    }

    return this.terrain.isWorldWalkable(worldX, worldY);
  }
}
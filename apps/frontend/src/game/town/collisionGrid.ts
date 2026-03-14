import type { TerrainGameplayGrid } from "../terrain/gameplayGrid";
import { isInsideOffice, worldToOfficeCell, type TownOfficeRegion } from "./layout";

/**
 * Unified walkability grid at 16px resolution.
 *
 * For any world-pixel query the office region takes precedence:
 *   - Inside office footprint → tile kind determines walkability (floor = walkable)
 *   - Outside office footprint → delegate to TerrainGameplayGrid
 *
 * The underlying terrain data is unchanged and still renders under the office.
 */
export class TownCollisionGrid {
  constructor(
    private readonly terrain: TerrainGameplayGrid,
    private readonly office: TownOfficeRegion | null,
  ) {}

  isWorldWalkable(worldX: number, worldY: number): boolean {
    const office = this.office;
    if (office && isInsideOffice(worldX, worldY, office)) {
      const cell = worldToOfficeCell(worldX, worldY, office);
      if (cell) {
        const tile = office.layout.tiles[cell.row * office.layout.cols + cell.col];
        return tile?.kind === "floor";
      }
      return false;
    }
    return this.terrain.isWorldWalkable(worldX, worldY);
  }
}

import type { TerrainGridSpec } from "../terrain/contracts";
import type { OfficeSceneLayout } from "../scenes/office/bootstrap";
import { createOfficeSceneBootstrap } from "../scenes/office/bootstrap";
import { loadTerrainBootstrap } from "../terrain/bootstrap";

/**
 * The canonical base unit: 16px.
 * Both terrain cells (4 × 16px = 64px) and office cells (3 × 16px = 48px)
 * are multiples of this unit.
 */
export const TOWN_BASE_PX = 16;

/** Number of 16px units in one office cell (3 × 16px = 48px). */
const OFFICE_CELL_UNITS = 3;

export type TownLayout = {
  terrain: TerrainGridSpec;
  office: TownOfficeRegion | null;
};

export type TownOfficeRegion = {
  /** Top-left corner of the office in 16px grid units. */
  anchorX16: number;
  anchorY16: number;
  /** Office layout — cellSize is always 48px (DONARG_TILE_WORLD_SIZE * 3). */
  layout: OfficeSceneLayout;
};

export type OfficeCellCoord = {
  col: number;
  row: number;
};

/** Returns true if the world-pixel point falls inside the office footprint. */
export function isInsideOffice(
  worldX: number,
  worldY: number,
  region: TownOfficeRegion,
): boolean {
  const x16 = Math.floor(worldX / TOWN_BASE_PX);
  const y16 = Math.floor(worldY / TOWN_BASE_PX);
  const relX = x16 - region.anchorX16;
  const relY = y16 - region.anchorY16;
  return (
    relX >= 0 &&
    relY >= 0 &&
    relX < region.layout.cols * OFFICE_CELL_UNITS &&
    relY < region.layout.rows * OFFICE_CELL_UNITS
  );
}

/**
 * Converts a world-pixel position to an office cell coordinate.
 * Returns null if the point is outside the office footprint.
 */
export function worldToOfficeCell(
  worldX: number,
  worldY: number,
  region: TownOfficeRegion,
): OfficeCellCoord | null {
  const x16 = Math.floor(worldX / TOWN_BASE_PX);
  const y16 = Math.floor(worldY / TOWN_BASE_PX);
  const relX = x16 - region.anchorX16;
  const relY = y16 - region.anchorY16;

  if (
    relX < 0 ||
    relY < 0 ||
    relX >= region.layout.cols * OFFICE_CELL_UNITS ||
    relY >= region.layout.rows * OFFICE_CELL_UNITS
  ) {
    return null;
  }

  return {
    col: Math.floor(relX / OFFICE_CELL_UNITS),
    row: Math.floor(relY / OFFICE_CELL_UNITS),
  };
}

/**
 * Returns the world-pixel position of the top-left corner of an office cell.
 *
 * worldX = (anchorX16 + col * 3) * 16
 * worldY = (anchorY16 + row * 3) * 16
 */
export function officeCellToWorldPixel(
  col: number,
  row: number,
  region: TownOfficeRegion,
): { worldX: number; worldY: number } {
  return {
    worldX: (region.anchorX16 + col * OFFICE_CELL_UNITS) * TOWN_BASE_PX,
    worldY: (region.anchorY16 + row * OFFICE_CELL_UNITS) * TOWN_BASE_PX,
  };
}

/**
 * Hardcoded anchor for the single office.
 * anchorX16=20, anchorY16=20 → worldX=320, worldY=320.
 * The office must be at least one terrain cell (4 × 16px) from the terrain boundary.
 */
const DEFAULT_OFFICE_ANCHOR_X16 = 20;
const DEFAULT_OFFICE_ANCHOR_Y16 = 20;

/**
 * Produces the unified TownLayout by merging the existing terrain spec and
 * the default office layout with a hardcoded anchor position.
 */
export function loadTownLayout(): TownLayout {
  const { gridSpec } = loadTerrainBootstrap();
  const { layout } = createOfficeSceneBootstrap();

  return {
    terrain: gridSpec,
    office: {
      anchorX16: DEFAULT_OFFICE_ANCHOR_X16,
      anchorY16: DEFAULT_OFFICE_ANCHOR_Y16,
      layout,
    },
  };
}

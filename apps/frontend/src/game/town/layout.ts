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

/**
 * Returns the number of 16px base units per office cell for the given region.
 * Derived from `layout.cellSize` rather than a hard-coded constant so the
 * helper functions stay self-consistent if the cell size ever changes.
 */
function officeCellUnits(region: TownOfficeRegion): number {
  return Math.round(region.layout.cellSize / TOWN_BASE_PX);
}

type TownLayout = {
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
    relX < region.layout.cols * officeCellUnits(region) &&
    relY < region.layout.rows * officeCellUnits(region)
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

  const cu = officeCellUnits(region);
  if (relX < 0 || relY < 0 || relX >= region.layout.cols * cu || relY >= region.layout.rows * cu) {
    return null;
  }

  return {
    col: Math.floor(relX / cu),
    row: Math.floor(relY / cu),
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
  const cu = officeCellUnits(region);
  return {
    worldX: (region.anchorX16 + col * cu) * TOWN_BASE_PX,
    worldY: (region.anchorY16 + row * cu) * TOWN_BASE_PX,
  };
}

/**
 * Hardcoded anchor for the single office.
 * anchorX16=20, anchorY16=20 → worldX=320, worldY=320.
 * The office must be at least one terrain cell (4 × 16px) from the terrain boundary.
 */
// TODO(architecture-review): The office anchor is a hardcoded constant that assumes a
// single office always at (20, 20) in 16px units. If the game ever supports multiple
// buildings, a movable office, or loading anchor coordinates from level data, this must
// be replaced with a data-driven approach (e.g. loaded from a level JSON alongside the
// terrain seed). The `loadTownOfficeRegion()` function should accept an anchor parameter
// rather than reading a module constant.
const DEFAULT_OFFICE_ANCHOR_X16 = 20;
const DEFAULT_OFFICE_ANCHOR_Y16 = 20;

/**
 * Returns the office region with its hardcoded anchor position.
 * Does not load terrain data; prefer this over `loadTownLayout` when
 * only the office region is needed.
 */
export function loadTownOfficeRegion(): TownOfficeRegion {
  const { layout } = createOfficeSceneBootstrap();
  return {
    anchorX16: DEFAULT_OFFICE_ANCHOR_X16,
    anchorY16: DEFAULT_OFFICE_ANCHOR_Y16,
    layout,
  };
}

/**
 * Produces the unified TownLayout by merging the existing terrain spec and
 * the default office layout with a hardcoded anchor position.
 */
function loadTownLayout(): TownLayout {
  const { gridSpec } = loadTerrainBootstrap();
  return {
    terrain: gridSpec,
    office: loadTownOfficeRegion(),
  };
}

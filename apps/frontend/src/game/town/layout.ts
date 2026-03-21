import type { TerrainGridSpec } from "../terrain/contracts";
import type { OfficeSceneLayout } from "../scenes/office/bootstrap";
import { createOfficeSceneBootstrap } from "../scenes/office/bootstrap";
import { loadTerrainBootstrap } from "../terrain/bootstrap";

/**
 * The canonical base unit: 16px.
 * Terrain cells are 4 × 16px = 64px. Office cells are 1 × 16px = 16px (1:1 with sprites).
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
  /** Office layout — cellSize is 16px (DONARG_TILE_WORLD_SIZE, 1:1 with sprites). */
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
 * worldX = (anchorX16 + col * cu) * 16
 * worldY = (anchorY16 + row * cu) * 16
 *
 * where cu = officeCellUnits(region) = cellSize / 16 (currently 1 for 16px cells).
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
 * Default anchor for the single office: (20, 20) in 16px units → worldX=320, worldY=320.
 * The office must be at least one terrain cell (4 × 16px) from the terrain boundary.
 *
 * These are intentionally kept as named constants so `loadTownOfficeRegion()` can be
 * called without arguments and callers that load anchor coordinates from level data can
 * pass them explicitly instead.
 */
const DEFAULT_OFFICE_ANCHOR_X16 = 20;
const DEFAULT_OFFICE_ANCHOR_Y16 = 20;

/**
 * Returns the office region for the given anchor position (in 16px base units).
 * Defaults to `DEFAULT_OFFICE_ANCHOR_X16` / `DEFAULT_OFFICE_ANCHOR_Y16` so existing
 * call sites that do not supply an anchor continue to work unchanged.
 *
 * Pass explicit `anchorX16` / `anchorY16` values when loading anchor coordinates from
 * level data or when supporting multiple buildings.
 *
 * Does not load terrain data; prefer this over `loadTownLayout` when only the office
 * region is needed.
 */
export function loadTownOfficeRegion(
  anchorX16: number = DEFAULT_OFFICE_ANCHOR_X16,
  anchorY16: number = DEFAULT_OFFICE_ANCHOR_Y16,
): TownOfficeRegion {
  const { layout } = createOfficeSceneBootstrap();
  return {
    anchorX16,
    anchorY16,
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

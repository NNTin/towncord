export const WORLD_REGION_BASE_PX = 16;

export type AnchoredGridCellCoord = {
  col: number;
  row: number;
};

export type AnchoredGridLayout = {
  cols: number;
  rows: number;
  cellSize: number;
};

export type AnchoredGridRegion<TLayout extends AnchoredGridLayout = AnchoredGridLayout> = {
  anchorX16: number;
  anchorY16: number;
  layout: TLayout;
};

function gridCellUnits(region: AnchoredGridRegion): number {
  return Math.round(region.layout.cellSize / WORLD_REGION_BASE_PX);
}

export function isPointInsideAnchoredGridRegion(
  worldX: number,
  worldY: number,
  region: AnchoredGridRegion,
): boolean {
  const x16 = Math.floor(worldX / WORLD_REGION_BASE_PX);
  const y16 = Math.floor(worldY / WORLD_REGION_BASE_PX);
  const relX = x16 - region.anchorX16;
  const relY = y16 - region.anchorY16;

  return (
    relX >= 0 &&
    relY >= 0 &&
    relX < region.layout.cols * gridCellUnits(region) &&
    relY < region.layout.rows * gridCellUnits(region)
  );
}

export function worldToAnchoredGridCell(
  worldX: number,
  worldY: number,
  region: AnchoredGridRegion,
): AnchoredGridCellCoord | null {
  const x16 = Math.floor(worldX / WORLD_REGION_BASE_PX);
  const y16 = Math.floor(worldY / WORLD_REGION_BASE_PX);
  const relX = x16 - region.anchorX16;
  const relY = y16 - region.anchorY16;
  const cellUnits = gridCellUnits(region);

  if (
    relX < 0 ||
    relY < 0 ||
    relX >= region.layout.cols * cellUnits ||
    relY >= region.layout.rows * cellUnits
  ) {
    return null;
  }

  return {
    col: Math.floor(relX / cellUnits),
    row: Math.floor(relY / cellUnits),
  };
}

export function anchoredGridCellToWorldPixel(
  col: number,
  row: number,
  region: AnchoredGridRegion,
): { worldX: number; worldY: number } {
  const cellUnits = gridCellUnits(region);

  return {
    worldX: (region.anchorX16 + col * cellUnits) * WORLD_REGION_BASE_PX,
    worldY: (region.anchorY16 + row * cellUnits) * WORLD_REGION_BASE_PX,
  };
}
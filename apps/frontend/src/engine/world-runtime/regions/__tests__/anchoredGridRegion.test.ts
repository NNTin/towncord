import { describe, expect, test } from "vitest";
import {
  anchoredGridCellToWorldPixel,
  isPointInsideAnchoredGridRegion,
  worldToAnchoredGridCell,
  WORLD_REGION_BASE_PX,
  type AnchoredGridCellCoord,
  type AnchoredGridRegion,
} from "../anchoredGridRegion";
import type { OfficeSceneLayout } from "../../../../game/officeLayoutContract";

const OFFICE_CELL_SIZE = 16;

function makeRegion(
  anchorX16: number,
  anchorY16: number,
  cols: number,
  rows: number,
): AnchoredGridRegion<OfficeSceneLayout> {
  const tiles = Array.from({ length: cols * rows }, () => ({
    kind: "floor" as const,
    tileId: 0,
  }));
  const layout: OfficeSceneLayout = {
    cols,
    rows,
    cellSize: OFFICE_CELL_SIZE,
    tiles,
    furniture: [],
    characters: [],
  };

  return { anchorX16, anchorY16, layout };
}

describe("anchoredGridCellToWorldPixel", () => {
  test("cell (0,0) maps to the anchor world position", () => {
    const region = makeRegion(20, 20, 5, 5);
    expect(anchoredGridCellToWorldPixel(0, 0, region)).toEqual({
      worldX: 20 * WORLD_REGION_BASE_PX,
      worldY: 20 * WORLD_REGION_BASE_PX,
    });
  });

  test("cell (1,0) is exactly one 16px cell to the right of the anchor", () => {
    const region = makeRegion(20, 20, 5, 5);
    const { worldX } = anchoredGridCellToWorldPixel(1, 0, region);
    expect(worldX).toBe(20 * WORLD_REGION_BASE_PX + OFFICE_CELL_SIZE);
  });

  test("cell (0,1) is exactly one 16px cell below the anchor", () => {
    const region = makeRegion(20, 20, 5, 5);
    const { worldY } = anchoredGridCellToWorldPixel(0, 1, region);
    expect(worldY).toBe(20 * WORLD_REGION_BASE_PX + OFFICE_CELL_SIZE);
  });

  test("adjacent cells are 16px apart", () => {
    const region = makeRegion(0, 0, 10, 10);
    const a = anchoredGridCellToWorldPixel(3, 2, region);
    const b = anchoredGridCellToWorldPixel(4, 2, region);
    expect(b.worldX - a.worldX).toBe(OFFICE_CELL_SIZE);
  });

  test("cell world positions are multiples of 16px", () => {
    const region = makeRegion(7, 13, 4, 4);
    for (let col = 0; col < 4; col += 1) {
      for (let row = 0; row < 4; row += 1) {
        const { worldX, worldY } = anchoredGridCellToWorldPixel(col, row, region);
        expect(worldX % WORLD_REGION_BASE_PX).toBe(0);
        expect(worldY % WORLD_REGION_BASE_PX).toBe(0);
      }
    }
  });
});

describe("isPointInsideAnchoredGridRegion", () => {
  const region = makeRegion(20, 20, 3, 3);

  test("center of the region is inside", () => {
    const { worldX, worldY } = anchoredGridCellToWorldPixel(1, 1, region);
    expect(isPointInsideAnchoredGridRegion(worldX + 8, worldY + 8, region)).toBe(true);
  });

  test("top-left corner pixel is inside", () => {
    expect(isPointInsideAnchoredGridRegion(20 * WORLD_REGION_BASE_PX, 20 * WORLD_REGION_BASE_PX, region)).toBe(true);
  });

  test("one pixel before the left edge is outside", () => {
    expect(isPointInsideAnchoredGridRegion(20 * WORLD_REGION_BASE_PX - 1, 20 * WORLD_REGION_BASE_PX, region)).toBe(false);
  });

  test("one pixel before the top edge is outside", () => {
    expect(isPointInsideAnchoredGridRegion(20 * WORLD_REGION_BASE_PX, 20 * WORLD_REGION_BASE_PX - 1, region)).toBe(false);
  });

  test("first pixel past the right edge is outside", () => {
    const rightEdge = (20 + 3) * WORLD_REGION_BASE_PX;
    expect(isPointInsideAnchoredGridRegion(rightEdge, 20 * WORLD_REGION_BASE_PX, region)).toBe(false);
  });

  test("first pixel past the bottom edge is outside", () => {
    const bottomEdge = (20 + 3) * WORLD_REGION_BASE_PX;
    expect(isPointInsideAnchoredGridRegion(20 * WORLD_REGION_BASE_PX, bottomEdge, region)).toBe(false);
  });

  test("last pixel inside the bottom-right cell is inside", () => {
    const rightEdge = (20 + 3) * WORLD_REGION_BASE_PX;
    expect(isPointInsideAnchoredGridRegion(rightEdge - 1, rightEdge - 1, region)).toBe(true);
  });
});

describe("worldToAnchoredGridCell", () => {
  const region = makeRegion(20, 20, 4, 4);

  test("anchor pixel maps to cell (0,0)", () => {
    expect(worldToAnchoredGridCell(20 * WORLD_REGION_BASE_PX, 20 * WORLD_REGION_BASE_PX, region)).toEqual<AnchoredGridCellCoord>({
      col: 0,
      row: 0,
    });
  });

  test("last pixel of cell (0,0) maps to cell (0,0)", () => {
    const result = worldToAnchoredGridCell(
      20 * WORLD_REGION_BASE_PX + OFFICE_CELL_SIZE - 1,
      20 * WORLD_REGION_BASE_PX,
      region,
    );
    expect(result).toEqual<AnchoredGridCellCoord>({ col: 0, row: 0 });
  });

  test("first pixel of cell (1,0) maps to cell (1,0)", () => {
    const result = worldToAnchoredGridCell(
      20 * WORLD_REGION_BASE_PX + OFFICE_CELL_SIZE,
      20 * WORLD_REGION_BASE_PX,
      region,
    );
    expect(result).toEqual<AnchoredGridCellCoord>({ col: 1, row: 0 });
  });

  test("point outside region returns null", () => {
    expect(worldToAnchoredGridCell(0, 0, region)).toBeNull();
  });

  test("right edge pixel returns null", () => {
    const rightEdge = (20 + 4) * WORLD_REGION_BASE_PX;
    expect(worldToAnchoredGridCell(rightEdge, 20 * WORLD_REGION_BASE_PX, region)).toBeNull();
  });

  test("cell (col, row) round-trips through anchoredGridCellToWorldPixel", () => {
    const col = 2;
    const row = 3;
    const { worldX, worldY } = anchoredGridCellToWorldPixel(col, row, region);
    expect(worldToAnchoredGridCell(worldX, worldY, region)).toEqual<AnchoredGridCellCoord>({ col, row });
  });

  test("all pixels within a cell map to that cell", () => {
    const { worldX, worldY } = anchoredGridCellToWorldPixel(1, 2, region);
    for (let dx = 0; dx < OFFICE_CELL_SIZE; dx += 4) {
      for (let dy = 0; dy < OFFICE_CELL_SIZE; dy += 4) {
        expect(worldToAnchoredGridCell(worldX + dx, worldY + dy, region)).toEqual<AnchoredGridCellCoord>({
          col: 1,
          row: 2,
        });
      }
    }
  });

  test("boundary between cells (1,0) and (2,0) is at a 16px boundary", () => {
    const cell1End = anchoredGridCellToWorldPixel(1, 0, region).worldX + OFFICE_CELL_SIZE;
    expect(cell1End % WORLD_REGION_BASE_PX).toBe(0);
    expect(worldToAnchoredGridCell(cell1End - 1, 20 * WORLD_REGION_BASE_PX, region)).toEqual<AnchoredGridCellCoord>({ col: 1, row: 0 });
    expect(worldToAnchoredGridCell(cell1End, 20 * WORLD_REGION_BASE_PX, region)).toEqual<AnchoredGridCellCoord>({ col: 2, row: 0 });
  });
});
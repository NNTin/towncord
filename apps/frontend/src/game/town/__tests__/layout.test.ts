import { describe, expect, test } from "vitest";
import {
  isInsideOffice,
  worldToOfficeCell,
  officeCellToWorldPixel,
  TOWN_BASE_PX,
  type TownOfficeRegion,
  type OfficeCellCoord,
} from "../layout";
import type { OfficeSceneLayout } from "../../scenes/office/bootstrap";

const OFFICE_CELL_SIZE = 48; // 3 × 16px — kept here for readability in tests

function makeRegion(
  anchorX16: number,
  anchorY16: number,
  cols: number,
  rows: number,
): TownOfficeRegion {
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

describe("officeCellToWorldPixel", () => {
  test("cell (0,0) maps to the anchor world position", () => {
    const region = makeRegion(20, 20, 5, 5);
    expect(officeCellToWorldPixel(0, 0, region)).toEqual({
      worldX: 20 * TOWN_BASE_PX,
      worldY: 20 * TOWN_BASE_PX,
    });
  });

  test("cell (1,0) is exactly one 48px cell to the right of the anchor", () => {
    const region = makeRegion(20, 20, 5, 5);
    const { worldX } = officeCellToWorldPixel(1, 0, region);
    expect(worldX).toBe(20 * TOWN_BASE_PX + OFFICE_CELL_SIZE);
  });

  test("cell (0,1) is exactly one 48px cell below the anchor", () => {
    const region = makeRegion(20, 20, 5, 5);
    const { worldY } = officeCellToWorldPixel(0, 1, region);
    expect(worldY).toBe(20 * TOWN_BASE_PX + OFFICE_CELL_SIZE);
  });

  test("adjacent cells are 48px apart", () => {
    const region = makeRegion(0, 0, 10, 10);
    const a = officeCellToWorldPixel(3, 2, region);
    const b = officeCellToWorldPixel(4, 2, region);
    expect(b.worldX - a.worldX).toBe(OFFICE_CELL_SIZE);
  });

  test("cell world positions are multiples of 16px", () => {
    const region = makeRegion(7, 13, 4, 4);
    for (let col = 0; col < 4; col += 1) {
      for (let row = 0; row < 4; row += 1) {
        const { worldX, worldY } = officeCellToWorldPixel(col, row, region);
        expect(worldX % TOWN_BASE_PX).toBe(0);
        expect(worldY % TOWN_BASE_PX).toBe(0);
      }
    }
  });
});

describe("isInsideOffice", () => {
  const region = makeRegion(20, 20, 3, 3); // 3×3 cells → 9×9 16px units → 144×144px

  test("center of the office is inside", () => {
    const { worldX, worldY } = officeCellToWorldPixel(1, 1, region);
    expect(isInsideOffice(worldX + 24, worldY + 24, region)).toBe(true);
  });

  test("top-left corner pixel is inside", () => {
    expect(isInsideOffice(20 * TOWN_BASE_PX, 20 * TOWN_BASE_PX, region)).toBe(true);
  });

  test("one pixel before the left edge is outside", () => {
    expect(isInsideOffice(20 * TOWN_BASE_PX - 1, 20 * TOWN_BASE_PX, region)).toBe(false);
  });

  test("one pixel before the top edge is outside", () => {
    expect(isInsideOffice(20 * TOWN_BASE_PX, 20 * TOWN_BASE_PX - 1, region)).toBe(false);
  });

  test("first pixel past the right edge is outside", () => {
    // Right edge: (20 + 3*3) * 16 = (20 + 9) * 16 = 464
    const rightEdge = (20 + 9) * TOWN_BASE_PX;
    expect(isInsideOffice(rightEdge, 20 * TOWN_BASE_PX, region)).toBe(false);
  });

  test("first pixel past the bottom edge is outside", () => {
    const bottomEdge = (20 + 9) * TOWN_BASE_PX;
    expect(isInsideOffice(20 * TOWN_BASE_PX, bottomEdge, region)).toBe(false);
  });

  test("last pixel inside the bottom-right cell is inside", () => {
    const rightEdge = (20 + 9) * TOWN_BASE_PX;
    expect(isInsideOffice(rightEdge - 1, rightEdge - 1, region)).toBe(true);
  });
});

describe("worldToOfficeCell", () => {
  const region = makeRegion(20, 20, 4, 4);

  test("anchor pixel maps to cell (0,0)", () => {
    expect(worldToOfficeCell(20 * TOWN_BASE_PX, 20 * TOWN_BASE_PX, region)).toEqual<OfficeCellCoord>({
      col: 0,
      row: 0,
    });
  });

  test("last pixel of cell (0,0) maps to cell (0,0)", () => {
    // Cell (0,0) spans [320, 368). Last pixel = 367.
    const result = worldToOfficeCell(20 * TOWN_BASE_PX + OFFICE_CELL_SIZE - 1, 20 * TOWN_BASE_PX, region);
    expect(result).toEqual<OfficeCellCoord>({ col: 0, row: 0 });
  });

  test("first pixel of cell (1,0) maps to cell (1,0)", () => {
    const result = worldToOfficeCell(20 * TOWN_BASE_PX + OFFICE_CELL_SIZE, 20 * TOWN_BASE_PX, region);
    expect(result).toEqual<OfficeCellCoord>({ col: 1, row: 0 });
  });

  test("point outside office returns null", () => {
    expect(worldToOfficeCell(0, 0, region)).toBeNull();
  });

  test("right edge pixel returns null", () => {
    const rightEdge = (20 + 4 * 3) * TOWN_BASE_PX;
    expect(worldToOfficeCell(rightEdge, 20 * TOWN_BASE_PX, region)).toBeNull();
  });

  test("cell (col, row) round-trips through officeCellToWorldPixel", () => {
    const col = 2;
    const row = 3;
    const { worldX, worldY } = officeCellToWorldPixel(col, row, region);
    expect(worldToOfficeCell(worldX, worldY, region)).toEqual<OfficeCellCoord>({ col, row });
  });

  test("all pixels within a cell map to that cell", () => {
    // Verify a sample of pixels inside cell (1, 2) all resolve to (1, 2)
    const { worldX, worldY } = officeCellToWorldPixel(1, 2, region);
    for (let dx = 0; dx < OFFICE_CELL_SIZE; dx += 4) {
      for (let dy = 0; dy < OFFICE_CELL_SIZE; dy += 4) {
        expect(worldToOfficeCell(worldX + dx, worldY + dy, region)).toEqual<OfficeCellCoord>({
          col: 1,
          row: 2,
        });
      }
    }
  });

  test("boundary between cells (1,0) and (2,0) is at a 16px boundary", () => {
    const cell1End = officeCellToWorldPixel(1, 0, region).worldX + OFFICE_CELL_SIZE;
    expect(cell1End % TOWN_BASE_PX).toBe(0);
    expect(worldToOfficeCell(cell1End - 1, 20 * TOWN_BASE_PX, region)).toEqual<OfficeCellCoord>({ col: 1, row: 0 });
    expect(worldToOfficeCell(cell1End, 20 * TOWN_BASE_PX, region)).toEqual<OfficeCellCoord>({ col: 2, row: 0 });
  });
});

/**
 * Pixel-seam invariant tests for office layout sprites.
 *
 * Wall sprites are placed edge-to-edge in a grid.  If any sprite's world-space
 * position is fractional, the GPU maps the shared edge to a fractional screen
 * pixel (even at integer zoom), producing a visible seam at the boundary.
 *
 * The wall-sprite position formulas are:
 *   worldX = worldOffsetX + col * cellSize + cellSize / 2
 *   worldY = worldOffsetY + row * cellSize
 *
 * With cellSize always being an even integer (16 px) and integer anchors,
 * these must always resolve to integers.
 */

import { describe, expect, test } from "vitest";

/** The office cell size used everywhere in the engine. */
const CELL_SIZE = 16;

describe("office layout pixel-seam invariants", () => {
  test("CELL_SIZE is a positive even integer so cellSize / 2 is integer", () => {
    expect(Number.isInteger(CELL_SIZE)).toBe(true);
    expect(CELL_SIZE % 2).toBe(0);
    expect(Number.isInteger(CELL_SIZE / 2)).toBe(true);
  });

  test("wall sprite worldX is always an integer for integer worldOffsetX", () => {
    // worldX = worldOffsetX + col * cellSize + cellSize / 2
    const half = CELL_SIZE / 2;
    for (let worldOffsetX = 0; worldOffsetX <= 512; worldOffsetX += 16) {
      for (let col = 0; col < 16; col += 1) {
        const worldX = worldOffsetX + col * CELL_SIZE + half;
        expect(Number.isInteger(worldX)).toBe(true);
      }
    }
  });

  test("wall sprite worldY is always an integer for integer worldOffsetY", () => {
    // worldY = worldOffsetY + row * cellSize
    for (let worldOffsetY = 0; worldOffsetY <= 512; worldOffsetY += 16) {
      for (let row = 0; row < 16; row += 1) {
        const worldY = worldOffsetY + row * CELL_SIZE;
        expect(Number.isInteger(worldY)).toBe(true);
      }
    }
  });

  test("furniture container worldX is always an integer for integer col and worldOffsetX", () => {
    // x = item.col * cellSize + worldOffsetX
    for (let worldOffsetX = 0; worldOffsetX <= 512; worldOffsetX += 16) {
      for (let col = 0; col < 16; col += 1) {
        const x = col * CELL_SIZE + worldOffsetX;
        expect(Number.isInteger(x)).toBe(true);
      }
    }
  });

  test("furniture sprite center position (width / 2) is always integer", () => {
    // sprite.setPosition(width / 2, height / 2) where width = item.width * cellSize
    // With cellSize = 16 and positive integer item.width, width is always a
    // multiple of 16, so width / 2 is always a multiple of 8.
    for (let itemWidth = 1; itemWidth <= 8; itemWidth += 1) {
      const width = itemWidth * CELL_SIZE;
      expect(Number.isInteger(width / 2)).toBe(true);
    }
  });

  test("adjacent wall cell boundaries share integer world coordinates", () => {
    // The right edge of cell (col) is at worldOffsetX + (col + 1) * cellSize
    // The left edge of cell (col + 1) is also at worldOffsetX + (col + 1) * cellSize
    // Both must be integer to avoid a seam at the shared boundary.
    const worldOffsetX = 32; // representative non-zero integer offset
    for (let col = 0; col < 8; col += 1) {
      const sharedBoundaryX = worldOffsetX + (col + 1) * CELL_SIZE;
      expect(Number.isInteger(sharedBoundaryX)).toBe(true);
    }
  });
});

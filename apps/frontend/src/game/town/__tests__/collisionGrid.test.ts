import { describe, expect, test } from "vitest";
import { TownCollisionGrid } from "../collisionGrid";
import { officeCellToWorldPixel, TOWN_BASE_PX, type TownOfficeRegion } from "../layout";
import type { OfficeSceneLayout, OfficeSceneTile } from "../../officeLayoutContract";
import { TERRAIN_CHUNK_SIZE, type TerrainGridSpec } from "../../terrain/contracts";
import { TerrainGameplayGrid } from "../../terrain/gameplayGrid";
import { TerrainMapStore } from "../../terrain/store";

/**
 * Builds a small terrain grid (all walkable "ground" by default).
 * Width and height must be multiples of TERRAIN_CHUNK_SIZE.
 */
function makeTerrainGrid(
  width = TERRAIN_CHUNK_SIZE,
  height = TERRAIN_CHUNK_SIZE,
  fill: "ground" | "water" = "ground",
): TerrainGameplayGrid {
  const spec: TerrainGridSpec = {
    width,
    height,
    chunkSize: TERRAIN_CHUNK_SIZE,
    defaultMaterial: fill,
    materials: ["ground", "water"],
    cells: Array.from({ length: width * height }, () => fill),
  };
  return new TerrainGameplayGrid(new TerrainMapStore(spec));
}

function makeOfficeRegion(
  anchorX16: number,
  anchorY16: number,
  cols: number,
  rows: number,
  tileKinds: Array<"floor" | "wall" | "void"> = [],
): TownOfficeRegion {
  const defaultKinds = Array.from({ length: cols * rows }, (_, i) => tileKinds[i] ?? "floor");
  const tiles: OfficeSceneTile[] = defaultKinds.map((kind) => ({ kind, tileId: 0 }));
  const layout: OfficeSceneLayout = {
    cols,
    rows,
    cellSize: 16,
    tiles,
    furniture: [],
    characters: [],
  };
  return { anchorX16, anchorY16, layout };
}

describe("TownCollisionGrid — no office", () => {
  test("delegates to terrain when office is null", () => {
    const grid = new TownCollisionGrid(makeTerrainGrid(32, 32, "ground"), null);
    expect(grid.isWorldWalkable(100, 100)).toBe(true);
  });

  test("water terrain is not walkable when no office", () => {
    const grid = new TownCollisionGrid(makeTerrainGrid(32, 32, "water"), null);
    expect(grid.isWorldWalkable(100, 100)).toBe(false);
  });
});

describe("TownCollisionGrid — office precedence", () => {
  // Office anchored at (20, 20) in 16px units → world pixel (320, 320)
  // 4×4 cells: all floor except top-left cell is wall
  const anchorX16 = 20;
  const anchorY16 = 20;
  const cols = 4;
  const rows = 4;

  // Cell (0,0) = wall, everything else = floor
  const tileKinds: Array<"floor" | "wall" | "void"> = Array.from(
    { length: cols * rows },
    (): "floor" => "floor",
  );
  tileKinds[0] = "wall";

  const region = makeOfficeRegion(anchorX16, anchorY16, cols, rows, tileKinds);

  test("office floor cell is walkable even when terrain underneath is water", () => {
    const grid = new TownCollisionGrid(makeTerrainGrid(32, 32, "water"), region);
    // Cell (1,0) is floor — center pixel
    const { worldX, worldY } = officeCellToWorldPixel(1, 0, region);
    expect(grid.isWorldWalkable(worldX + 8, worldY + 8)).toBe(true);
  });

  test("office wall cell is not walkable even when terrain underneath is ground", () => {
    const grid = new TownCollisionGrid(makeTerrainGrid(32, 32, "ground"), region);
    // Cell (0,0) is wall
    const { worldX, worldY } = officeCellToWorldPixel(0, 0, region);
    expect(grid.isWorldWalkable(worldX + 8, worldY + 8)).toBe(false);
  });

  test("outside the office, terrain walkability applies", () => {
    const terrainGround = makeTerrainGrid(32, 32, "ground");
    const grid = new TownCollisionGrid(terrainGround, region);
    // World position well outside the office
    expect(grid.isWorldWalkable(10, 10)).toBe(true);
  });

  test("outside the office on water terrain, not walkable", () => {
    const grid = new TownCollisionGrid(makeTerrainGrid(32, 32, "water"), region);
    expect(grid.isWorldWalkable(10, 10)).toBe(false);
  });

  test("boundary pixel at top-left anchor is inside office", () => {
    const grid = new TownCollisionGrid(makeTerrainGrid(32, 32, "water"), region);
    // Cell (0,0) is a wall → not walkable regardless of terrain
    const anchorPx = anchorX16 * TOWN_BASE_PX;
    expect(grid.isWorldWalkable(anchorPx, anchorPx)).toBe(false);

    // Cell (1,0) is floor → walkable despite water terrain
    const { worldX, worldY } = officeCellToWorldPixel(1, 0, region);
    expect(grid.isWorldWalkable(worldX, worldY)).toBe(true);
  });

  test("first pixel past the right office edge defers to terrain", () => {
    // terrain = water, so outside the office is not walkable
    const grid = new TownCollisionGrid(makeTerrainGrid(32, 32, "water"), region);
    const rightEdge = (anchorX16 + cols * 1) * TOWN_BASE_PX;
    expect(grid.isWorldWalkable(rightEdge, anchorY16 * TOWN_BASE_PX + 8)).toBe(false);
  });

  test("all pixels of a floor cell are walkable", () => {
    const grid = new TownCollisionGrid(makeTerrainGrid(32, 32, "water"), region);
    const { worldX, worldY } = officeCellToWorldPixel(2, 2, region);
    for (let dx = 0; dx < 16; dx += 4) {
      for (let dy = 0; dy < 16; dy += 4) {
        expect(grid.isWorldWalkable(worldX + dx, worldY + dy)).toBe(true);
      }
    }
  });
});

import { describe, expect, test } from "vitest";
import { anchoredGridCellToWorldPixel, WORLD_REGION_BASE_PX, type AnchoredGridRegion } from "../../regions/anchoredGridRegion";
import { UnifiedCollisionMap, type AnchoredRegionCellLookup } from "../unifiedCollisionMap";
import type { OfficeSceneLayout, OfficeSceneTile } from "../../../../game/officeLayoutContract";
import { TERRAIN_CHUNK_SIZE, type TerrainGridSpec } from "../../../../game/terrain/contracts";
import { TerrainGameplayGrid } from "../../../../game/terrain/gameplayGrid";
import { TerrainMapStore } from "../../../../game/terrain/store";

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

function makeRegion(
  anchorX16: number,
  anchorY16: number,
  cols: number,
  rows: number,
  tileKinds: Array<"floor" | "wall" | "void"> = [],
): AnchoredRegionCellLookup<OfficeSceneLayout> {
  const defaultKinds = Array.from({ length: cols * rows }, (_, index) => tileKinds[index] ?? "floor");
  const tiles: OfficeSceneTile[] = defaultKinds.map((kind) => ({ kind, tileId: 0 }));
  const layout: OfficeSceneLayout = {
    cols,
    rows,
    cellSize: 16,
    tiles,
    furniture: [],
    characters: [],
  };
  const region: AnchoredGridRegion<OfficeSceneLayout> = {
    anchorX16,
    anchorY16,
    layout,
  };

  return {
    ...region,
    getCellKind(col, row) {
      return layout.tiles[row * layout.cols + col]?.kind ?? null;
    },
  };
}

describe("UnifiedCollisionMap", () => {
  test("delegates to terrain when no anchored region exists", () => {
    const map = new UnifiedCollisionMap(makeTerrainGrid(32, 32, "ground"), null);
    expect(map.isWorldWalkable(100, 100)).toBe(true);
  });

  test("uses terrain walkability when no anchored region exists", () => {
    const map = new UnifiedCollisionMap(makeTerrainGrid(32, 32, "water"), null);
    expect(map.isWorldWalkable(100, 100)).toBe(false);
  });

  test("anchored floor cells override blocked terrain", () => {
    const region = makeRegion(20, 20, 4, 4, ["wall", "floor", "floor", "floor"]);
    const map = new UnifiedCollisionMap(makeTerrainGrid(32, 32, "water"), region);
    const { worldX, worldY } = anchoredGridCellToWorldPixel(1, 0, region);
    expect(map.isWorldWalkable(worldX + 8, worldY + 8)).toBe(true);
  });

  test("anchored wall cells override walkable terrain", () => {
    const region = makeRegion(20, 20, 4, 4, ["wall"]);
    const map = new UnifiedCollisionMap(makeTerrainGrid(32, 32, "ground"), region);
    const { worldX, worldY } = anchoredGridCellToWorldPixel(0, 0, region);
    expect(map.isWorldWalkable(worldX + 8, worldY + 8)).toBe(false);
  });

  test("outside the anchored region falls back to terrain walkability", () => {
    const region = makeRegion(20, 20, 4, 4, ["wall"]);
    const map = new UnifiedCollisionMap(makeTerrainGrid(32, 32, "ground"), region);
    expect(map.isWorldWalkable(10, 10)).toBe(true);
  });

  test("the first pixel past the right edge falls back to terrain", () => {
    const region = makeRegion(20, 20, 4, 4, ["wall"]);
    const map = new UnifiedCollisionMap(makeTerrainGrid(32, 32, "water"), region);
    const rightEdge = (20 + 4) * WORLD_REGION_BASE_PX;
    expect(map.isWorldWalkable(rightEdge, 20 * WORLD_REGION_BASE_PX + 8)).toBe(false);
  });

  test("void cell over walkable terrain is walkable (erased floor falls through)", () => {
    const region = makeRegion(20, 20, 4, 4, ["void"]);
    const map = new UnifiedCollisionMap(makeTerrainGrid(32, 32, "ground"), region);
    const { worldX, worldY } = anchoredGridCellToWorldPixel(0, 0, region);
    expect(map.isWorldWalkable(worldX + 8, worldY + 8)).toBe(true);
  });

  test("void cell over blocked terrain is blocked (erased floor falls through to water)", () => {
    const region = makeRegion(20, 20, 4, 4, ["void"]);
    const map = new UnifiedCollisionMap(makeTerrainGrid(32, 32, "water"), region);
    const { worldX, worldY } = anchoredGridCellToWorldPixel(0, 0, region);
    expect(map.isWorldWalkable(worldX + 8, worldY + 8)).toBe(false);
  });
});
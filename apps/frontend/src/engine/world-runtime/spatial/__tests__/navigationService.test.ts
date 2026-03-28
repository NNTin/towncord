import { describe, expect, test } from "vitest";
import { createTerrainNavigationService } from "../navigationService";
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

describe("createTerrainNavigationService", () => {
  test("picks a reachable wander target", () => {
    const grid = makeTerrainGrid(32, 32, "ground");
    const service = createTerrainNavigationService(grid);
    const start = grid.cellToWorldCenter(10, 10)!;
    const expected = grid.cellToWorldCenter(11, 10)!;
    const rngValues = [0.6, 0.5];

    const target = service.pickWanderTarget(
      { position: { x: start.worldX, y: start.worldY } },
      () => rngValues.shift() ?? 0.5,
    );

    expect(target).toEqual({ x: expected.worldX, y: expected.worldY });
  });

  test("returns null when the subject starts on a blocked cell", () => {
    const grid = makeTerrainGrid(32, 32, "water");
    const service = createTerrainNavigationService(grid);

    expect(
      service.pickWanderTarget({ position: { x: 16, y: 16 } }, () => 0.5),
    ).toBeNull();
  });

  test("plans path waypoints and keeps the terrain revision", () => {
    const grid = makeTerrainGrid(32, 32, "ground");
    const service = createTerrainNavigationService(grid);
    const start = grid.cellToWorldCenter(1, 1)!;
    const target = grid.cellToWorldCenter(3, 1)!;
    const via = grid.cellToWorldCenter(2, 1)!;

    const path = service.planPath(
      { position: { x: start.worldX, y: start.worldY } },
      { x: target.worldX, y: target.worldY },
    );

    expect(path).toEqual({
      waypoints: [
        { x: via.worldX, y: via.worldY },
        { x: target.worldX, y: target.worldY },
      ],
      revision: 0,
    });
  });

  test("invalidates planned paths when the terrain revision changes", () => {
    const grid = makeTerrainGrid(32, 32, "ground");
    const service = createTerrainNavigationService(grid);

    expect(service.isPathValid(0)).toBe(true);
    grid.notifyCellsChanged([{ cellX: 0, cellY: 0 }]);
    expect(service.isPathValid(0)).toBe(false);
    expect(service.isPathValid(1)).toBe(true);
    expect(service.isPathValid(null)).toBe(false);
  });

  test("clamps world points to terrain bounds", () => {
    const grid = makeTerrainGrid(32, 32, "ground");
    const service = createTerrainNavigationService(grid);
    const bounds = grid.getWorldBounds();

    expect(service.clampToBounds({ x: -20, y: 9999 })).toEqual({
      x: 0,
      y: bounds.maxY,
    });
  });

  test("uses the collision override for movement walkability", () => {
    const grid = makeTerrainGrid(32, 32, "ground");
    const service = createTerrainNavigationService(grid, {
      isWorldWalkable(worldX, worldY) {
        return !(worldX === 32 && worldY === 32);
      },
    });

    expect(service.isWalkable({ x: 32, y: 32 })).toBe(false);
    expect(service.isWalkable({ x: 48, y: 48 })).toBe(true);
  });

  test("does not pick a wander target blocked by the collision override", () => {
    const grid = makeTerrainGrid(32, 32, "ground");
    // Entity at cell (5,5). Override blocks all cells whose world center X
    // is strictly greater than the start cell's X, so every attempt that
    // produces a positive X offset lands in blocked territory.
    const startCell = grid.cellToWorldCenter(5, 5)!;
    const service = createTerrainNavigationService(grid, {
      isWorldWalkable(worldX) {
        return worldX <= startCell.worldX;
      },
    });

    // rng always returns 1 → offsetX = Math.floor(1*11)-5 = 6 (always moves right)
    // All 16 attempts target a cell with worldX > startCell.worldX → blocked → null
    const target = service.pickWanderTarget(
      { position: { x: startCell.worldX, y: startCell.worldY } },
      () => 1,
    );

    expect(target).toBeNull();
  });

  test("plans a path that avoids cells blocked by the collision override", () => {
    // Layout (32x32 ground):
    //   start at (0,0), target at (2,0)
    //   cell (1,0) is blocked by override — path must go around via (0,1),(1,1),(2,1)
    const grid = makeTerrainGrid(32, 32, "ground");
    const blockedCell = grid.cellToWorldCenter(1, 0)!;
    const service = createTerrainNavigationService(grid, {
      isWorldWalkable(worldX, worldY) {
        return !(worldX === blockedCell.worldX && worldY === blockedCell.worldY);
      },
    });

    const start = grid.cellToWorldCenter(0, 0)!;
    const goal = grid.cellToWorldCenter(2, 0)!;
    const path = service.planPath(
      { position: { x: start.worldX, y: start.worldY } },
      { x: goal.worldX, y: goal.worldY },
    );

    expect(path).not.toBeNull();
    // The direct route through (1,0) is blocked — path must detour
    const passesThrough = path!.waypoints.some(
      (wp) => wp.x === blockedCell.worldX && wp.y === blockedCell.worldY,
    );
    expect(passesThrough).toBe(false);
  });
});
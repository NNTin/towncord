import { describe, expect, test } from "vitest";
import { TERRAIN_CHUNK_SIZE, toTerrainChunkId, type TerrainChunkId, type TerrainGridSpec } from "../contracts";
import { TerrainMapStore } from "../store";

const WIDTH = 64;
const HEIGHT = 64;
const DEFAULT_MATERIAL = "grass";
const CHANGED_MATERIAL = "water";

function createGridSpec(): TerrainGridSpec {
  return {
    width: WIDTH,
    height: HEIGHT,
    chunkSize: TERRAIN_CHUNK_SIZE,
    defaultMaterial: DEFAULT_MATERIAL,
    materials: [DEFAULT_MATERIAL, CHANGED_MATERIAL],
    cells: Array.from({ length: WIDTH * HEIGHT }, () => DEFAULT_MATERIAL),
  };
}

function consumeDirtyChunkIds(store: TerrainMapStore): TerrainChunkId[] {
  return store.consumeDirtyChunks().map((chunk) => chunk.id);
}

describe("TerrainMapStore dirty chunk invalidation", () => {
  test("no-op edit does not dirty any chunk", () => {
    const store = new TerrainMapStore(createGridSpec());

    // Ignore bootstrap dirty chunks; we only care about runtime edit behavior.
    store.consumeDirtyChunks();

    const changed = store.applyEditOp({
      materialId: DEFAULT_MATERIAL,
      brushId: "terrain.brush.single",
      center: { cellX: 10, cellY: 10 },
    });

    expect(changed).toBe(false);
    expect(store.hasDirtyChunks()).toBe(false);
    expect(consumeDirtyChunkIds(store)).toEqual([]);
  });

  test("changed interior cell dirties owning chunk only", () => {
    const store = new TerrainMapStore(createGridSpec());
    store.consumeDirtyChunks();

    const changed = store.applyEditOp({
      materialId: CHANGED_MATERIAL,
      brushId: "terrain.brush.single",
      center: { cellX: 10, cellY: 10 },
    });

    expect(changed).toBe(true);
    expect(consumeDirtyChunkIds(store)).toEqual([toTerrainChunkId(0, 0)]);
  });

  test("boundary cell change dirties neighboring chunks that share marching-square cases", () => {
    const store = new TerrainMapStore(createGridSpec());
    store.consumeDirtyChunks();

    const changed = store.applyEditOp({
      materialId: CHANGED_MATERIAL,
      brushId: "terrain.brush.single",
      center: { cellX: 32, cellY: 32 },
    });

    expect(changed).toBe(true);
    expect(consumeDirtyChunkIds(store)).toEqual([
      toTerrainChunkId(0, 0),
      toTerrainChunkId(1, 0),
      toTerrainChunkId(0, 1),
      toTerrainChunkId(1, 1),
    ]);
  });
});

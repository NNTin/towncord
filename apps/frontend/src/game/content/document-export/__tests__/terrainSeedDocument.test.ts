import { describe, expect, test } from "vitest";
import {
  formatTerrainSeed,
  syncFromRuntimeTerrain,
  type TerrainSeedDocument,
} from "../terrainSeedDocument";
import {
  TERRAIN_CHUNK_SIZE,
  type TerrainGridSpec,
} from "../../../terrain/contracts";
import { TerrainMapStore } from "../../../terrain/store";

function createGridSpec(): TerrainGridSpec {
  return {
    width: 2,
    height: 2,
    chunkSize: TERRAIN_CHUNK_SIZE,
    defaultMaterial: "grass",
    materials: ["grass", "water"],
    cells: ["grass", "water", "grass", "grass"],
  };
}

describe("document export terrain seed translation", () => {
  test("formats terrain seed documents as stable JSON", () => {
    const document: TerrainSeedDocument = {
      width: 2,
      height: 1,
      chunkSize: 32,
      defaultMaterial: "grass",
      materials: ["grass"],
      legend: {
        ".": "grass",
      },
      rows: [".."],
    };

    expect(formatTerrainSeed(document)).toBe(
      `${JSON.stringify(document, null, 2)}\n`,
    );
  });

  test("syncs runtime terrain maps back into persisted documents", () => {
    const seed: TerrainSeedDocument = {
      width: 2,
      height: 2,
      chunkSize: TERRAIN_CHUNK_SIZE,
      defaultMaterial: "grass",
      materials: ["grass", "water"],
      legend: {
        ".": "grass",
        "~": "water",
      },
      rows: ["..", ".."],
    };
    const store = new TerrainMapStore(createGridSpec());
    store.setCellMaterial(1, 0, "water");

    expect(syncFromRuntimeTerrain(seed, store)).toEqual({
      ...seed,
      rows: [".~", ".."],
    });
  });
});

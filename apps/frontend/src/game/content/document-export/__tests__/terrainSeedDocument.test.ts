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
      width: seed.width,
      height: seed.height,
      chunkSize: seed.chunkSize,
      defaultMaterial: seed.defaultMaterial,
      materials: [...seed.materials],
      legend: { ...seed.legend },
      rows: [".~", ".."],
    });
  });

  test("exports optional terrain and office detail layers", () => {
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
    const terrainDetailsStore = new TerrainMapStore({
      width: 2,
      height: 2,
      chunkSize: TERRAIN_CHUNK_SIZE,
      defaultMaterial: "__empty__",
      materials: ["__empty__", "public-assets:terrain/farmrpg-barn-posts"],
      cells: [
        "public-assets:terrain/farmrpg-barn-posts",
        "__empty__",
        "__empty__",
        "__empty__",
      ],
    });
    const officeDetailsStore = new TerrainMapStore({
      width: 2,
      height: 2,
      chunkSize: TERRAIN_CHUNK_SIZE,
      defaultMaterial: "__empty__",
      materials: ["__empty__", "public-assets:terrain/farmrpg-carpet-01"],
      cells: [
        "__empty__",
        "__empty__",
        "__empty__",
        "public-assets:terrain/farmrpg-carpet-01",
      ],
    });

    expect(
      syncFromRuntimeTerrain(seed, store, {
        terrainDetailsStore,
        officeDetailsStore,
        terrainProps: [
          {
            propId: "prop.static.set-01.variant-01",
            cellX: 1,
            cellY: 0,
            rotationQuarterTurns: 3,
          },
        ],
      }),
    ).toEqual({
      width: seed.width,
      height: seed.height,
      chunkSize: seed.chunkSize,
      defaultMaterial: seed.defaultMaterial,
      materials: [...seed.materials],
      legend: { ...seed.legend },
      rows: [".~", ".."],
      terrainDetails: {
        legend: {
          ".": null,
          a: "public-assets:terrain/farmrpg-barn-posts",
        },
        rows: ["a.", ".."],
      },
      officeDetails: {
        legend: {
          ".": null,
          a: "public-assets:terrain/farmrpg-carpet-01",
        },
        rows: ["..", ".a"],
      },
      terrainProps: [
        {
          propId: "prop.static.set-01.variant-01",
          cellX: 1,
          cellY: 0,
          rotationQuarterTurns: 3,
        },
      ],
    });
  });
});

import { describe, expect, test } from "vitest";
import {
  loadTerrainBootstrap,
  validateTerrainBootstrap,
} from "../terrainBootstrap";
import type { TerrainSeedDocument } from "../../../../../data/world-seeds/terrainSeedDocument";
import type { TerrainRulesetFile } from "../../../../../data/terrain/terrainRulesetDocument";
import { TERRAIN_CHUNK_SIZE } from "../../../../terrain/contracts";

function createSceneStub() {
  return {
    textures: {
      exists: () => true,
      get: () => ({
        has: () => true,
      }),
    },
  } as const;
}

describe("terrain bootstrap compilation", () => {
  test("loads the default terrain seed and transition descriptors", () => {
    const bootstrap = loadTerrainBootstrap();

    expect(bootstrap.gridSpec).toMatchObject({
      width: 32,
      height: 32,
      chunkSize: 32,
      defaultMaterial: "ground",
      materials: ["ground", "water"],
    });
    expect(bootstrap.gridSpec.cells).toHaveLength(32 * 32);
    expect(bootstrap.transition).toMatchObject({
      id: "phase1-water-over-ground",
      insideMaterial: "water",
      outsideMaterial: "ground",
    });
    expect(bootstrap.transition.rules).toHaveLength(16);
  });

  test("validates the compiled terrain bootstrap against the render surface", () => {
    expect(() =>
      validateTerrainBootstrap(createSceneStub() as never, loadTerrainBootstrap()),
    ).not.toThrow();
  });

  test("rejects rulesets without a default transition", () => {
    const seed: TerrainSeedDocument = {
      width: 2,
      height: 2,
      chunkSize: 2,
      defaultMaterial: "ground",
      materials: ["ground", "water"],
      legend: {
        ".": "ground",
        "~": "water",
      },
      rows: ["..", "~~"],
    };
    const ruleset: TerrainRulesetFile = { transitions: [] };

    expect(() => loadTerrainBootstrap(seed, ruleset)).toThrow(
      "Terrain ruleset fixture has no transitions.",
    );
  });

  test("surfaces descriptive validation errors for malformed bootstrap payloads", () => {
    const scene = {
      textures: {
        exists: () => false,
      },
    } as const;

    try {
      validateTerrainBootstrap(scene as never, {
        gridSpec: {
          width: 3,
          height: 2,
          chunkSize: (TERRAIN_CHUNK_SIZE - 1) as never,
          defaultMaterial: "water",
          materials: ["ground"],
          cells: ["ground"],
        },
        transition: {
          id: "bad-transition",
          insideMaterial: "water",
          outsideMaterial: "ground",
          rules: [
            {
              caseId: -1,
              frame: "missing-frame",
            },
          ],
        },
      });
      throw new Error("Expected terrain bootstrap validation to fail.");
    } catch (error) {
      expect((error as Error).message).toContain(
        `chunkSize must be ${TERRAIN_CHUNK_SIZE}`,
      );
      expect((error as Error).message).toContain(
        "transition must provide 16 rules, got 1.",
      );
      expect((error as Error).message).toContain(
        'texture key "debug.tilesets" is not loaded.',
      );
    }
  });
});

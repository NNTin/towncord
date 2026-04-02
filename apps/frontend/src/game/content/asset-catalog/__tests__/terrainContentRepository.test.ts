import { describe, expect, test } from "vitest";
import {
  ALL_TERRAIN_SOURCE_IDS,
  createStaticTerrainContentRepository,
  readTerrainContent,
} from "../terrainContentRepository";

describe("terrain content repository", () => {
  test("returns cloned snapshots for each read", () => {
    const repository = createStaticTerrainContentRepository({
      sourceId: "test-terrain",
      textureKey: "test-terrain-texture",
      seed: {
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
      },
      ruleset: {
        transitions: [
          {
            id: "water-over-ground",
            insideMaterial: "water",
            outsideMaterial: "ground",
            rules: Array.from({ length: 16 }, (_, caseId) => ({
              caseId,
              frame: `tile-${caseId}`,
            })),
          },
        ],
      },
    });

    const first = repository.read();
    const second = repository.read();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.seed).not.toBe(second.seed);
    expect(first.ruleset).not.toBe(second.ruleset);

    first.seed.rows[0] = "~~";
    first.ruleset.transitions[0]?.rules.splice(0, 1);

    const third = repository.read();
    expect(third.seed.rows[0]).toBe("..");
    expect(third.ruleset.transitions[0]?.rules).toHaveLength(16);
  });

  test("exposes FarmRPG static terrain sources with generated autotile rules", () => {
    const content = readTerrainContent(
      "public-assets:terrain/farmrpg-barn-posts",
    );

    expect(ALL_TERRAIN_SOURCE_IDS).toContain(
      "public-assets:terrain/farmrpg-barn-posts",
    );
    expect(content.textureKey).toBe("farmrpg.tilesets");
    expect(content.ruleset.transitions).toHaveLength(1);
    expect(content.ruleset.transitions[0]).toMatchObject({
      insideMaterial: "water",
      outsideMaterial: "ground",
    });
    expect(content.ruleset.transitions[0]?.rules).toHaveLength(16);
    expect(content.ruleset.transitions[0]?.rules[0]?.frame).toBe(
      "tilesets.farmrpg.barn.posts#0",
    );
    expect(content.ruleset.transitions[0]?.rules[15]?.frame).toBe(
      "tilesets.farmrpg.barn.posts#15",
    );
  });
});

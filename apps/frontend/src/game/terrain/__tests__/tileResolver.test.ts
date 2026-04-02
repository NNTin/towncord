import { describe, expect, test } from "vitest";
import { TerrainCaseMapper } from "../caseMapper";
import { MarchingSquaresKernel } from "../marchingSquaresKernel";
import { TerrainTileResolver } from "../tileResolver";

describe("TerrainTileResolver", () => {
  test("adds the inside fill frame for cases that include water", () => {
    const resolver = new TerrainTileResolver(
      new MarchingSquaresKernel(),
      new TerrainCaseMapper(
        Array.from({ length: 16 }, (_, caseId) => ({
          caseId,
          frame: `transition-${caseId}`,
        })),
      ),
      "water",
      "tilesets.farmrpg.water.tile#0",
    );

    const waterEverywhere = resolver.resolveRenderTile(() => "water", 4, 6);

    expect(waterEverywhere.caseId).toBe(15);
    expect(waterEverywhere.frame).toBe("transition-15");
    expect(waterEverywhere.underlayFrame).toBe("tilesets.farmrpg.water.tile#0");
  });

  test("skips the inside fill frame for all-ground cases", () => {
    const resolver = new TerrainTileResolver(
      new MarchingSquaresKernel(),
      new TerrainCaseMapper(
        Array.from({ length: 16 }, (_, caseId) => ({
          caseId,
          frame: `transition-${caseId}`,
        })),
      ),
      "water",
      "tilesets.farmrpg.water.tile#0",
    );

    const groundEverywhere = resolver.resolveRenderTile(() => "ground", 1, 2);

    expect(groundEverywhere.caseId).toBe(0);
    expect(groundEverywhere.underlayFrame).toBeUndefined();
  });
});

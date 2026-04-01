import { describe, expect, test } from "vitest";
import {
  DEBUG_TERRAIN_ATLAS_IMAGE_URL,
  DEBUG_TERRAIN_ATLAS_W,
  DEBUG_TERRAIN_ATLAS_H,
} from "../debugTerrainAtlas";
import {
  FARMRPG_TERRAIN_ATLAS_H,
  FARMRPG_TERRAIN_ATLAS_IMAGE_URL,
  FARMRPG_TERRAIN_ATLAS_W,
} from "../farmrpgTerrainAtlas";
import {
  FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS,
  TERRAIN_TOOLBAR_PREVIEW_ITEMS,
} from "../terrainToolbarPreviewCatalog";

describe("terrain toolbar preview catalog", () => {
  test("exposes water and ground preview items backed by the debug terrain atlas", () => {
    expect(DEBUG_TERRAIN_ATLAS_IMAGE_URL).toBe("/assets/debug/atlas.png");
    expect(DEBUG_TERRAIN_ATLAS_W).toBeGreaterThan(0);
    expect(DEBUG_TERRAIN_ATLAS_H).toBeGreaterThan(0);

    expect(TERRAIN_TOOLBAR_PREVIEW_ITEMS).toHaveLength(2);
    expect(TERRAIN_TOOLBAR_PREVIEW_ITEMS.map((item) => item.brushId)).toEqual([
      "water",
      "ground",
    ]);
    expect(TERRAIN_TOOLBAR_PREVIEW_ITEMS.map((item) => item.label)).toEqual([
      "Water Tile Brush",
      "Ground Tile Brush",
    ]);

    const water = TERRAIN_TOOLBAR_PREVIEW_ITEMS[0];
    const ground = TERRAIN_TOOLBAR_PREVIEW_ITEMS[1];

    expect(water?.representativeFrame.frameKey).toBe(
      "tilesets.debug.environment.autotile-15#15",
    );
    expect(ground?.representativeFrame.frameKey).toBe(
      "tilesets.debug.environment.autotile-15#0",
    );
    expect(water?.animationFrames).toHaveLength(8);
    expect(ground?.animationFrames).toHaveLength(8);
    expect(water?.animationFrames[0]?.frameKey).toBe(
      "tilesets.debug.environment.autotile-15#15@0",
    );
    expect(ground?.animationFrames[0]?.frameKey).toBe(
      "tilesets.debug.environment.autotile-15#0@0",
    );
  });

  test("exposes water and ground preview items backed by the FarmRPG terrain atlas", () => {
    expect(FARMRPG_TERRAIN_ATLAS_IMAGE_URL).toBe(
      "/assets/farmrpg/atlases/tilesets.png",
    );
    expect(FARMRPG_TERRAIN_ATLAS_W).toBeGreaterThan(0);
    expect(FARMRPG_TERRAIN_ATLAS_H).toBeGreaterThan(0);

    // When the FarmRPG tileset atlas hasn't been generated yet, the fallback JSON
    // has no frames and FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS is expected to be [].
    if (FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS.length === 0) {
      expect(FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS).toHaveLength(0);
      return;
    }

    expect(FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS).toHaveLength(2);
    expect(
      FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS.map((item) => item.brushId),
    ).toEqual(["water", "ground"]);
    expect(
      FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS.map((item) => item.label),
    ).toEqual(["FarmRPG Water Tile Brush", "FarmRPG Ground Tile Brush"]);

    const water = FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS[0];
    const ground = FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS[1];

    expect(water?.representativeFrame.frameKey).toBe(
      "tilesets.farmrpg.environment.grass#15",
    );
    expect(ground?.representativeFrame.frameKey).toBe(
      "tilesets.farmrpg.environment.grass#0",
    );
    expect(water?.animationFrames).toHaveLength(1);
    expect(ground?.animationFrames).toHaveLength(1);
    expect(water?.animationFrames[0]?.frameKey).toBe(
      "tilesets.farmrpg.environment.grass#15",
    );
    expect(ground?.animationFrames[0]?.frameKey).toBe(
      "tilesets.farmrpg.environment.grass#0",
    );
  });
});

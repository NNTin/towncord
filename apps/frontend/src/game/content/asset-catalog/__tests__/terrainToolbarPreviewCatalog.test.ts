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

  test("exposes seasonal FarmRPG preview items backed by the terrain atlas", () => {
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

    expect(FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS.length).toBeGreaterThanOrEqual(
      8,
    );

    const springWater = FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS.find(
      (item) => item.id === "terrain.farmrpg.spring.water.tile",
    );
    const summerGround = FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS.find(
      (item) => item.id === "terrain.farmrpg.summer.ground.tile",
    );
    const winterWater = FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS.find(
      (item) => item.id === "terrain.farmrpg.winter.water.tile",
    );

    expect(springWater?.label).toBe("FarmRPG Spring Water Tile Brush");
    expect(springWater?.groupLabel).toBe("Spring");
    expect(springWater?.representativeFrame.frameKey).toBe(
      "tilesets.farmrpg.water.tile#0",
    );
    expect(springWater?.animationFrames).toHaveLength(1);
    expect(springWater?.animationFrames[0]?.frameKey).toBe(
      "tilesets.farmrpg.water.tile#0@0",
    );

    expect(summerGround?.label).toBe("FarmRPG Summer Ground Tile Brush");
    expect(summerGround?.groupLabel).toBe("Summer");
    expect(summerGround?.representativeFrame.frameKey).toBe(
      "tilesets.farmrpg.grass.summer#0",
    );
    expect(summerGround?.animationFrames).toHaveLength(1);

    expect(winterWater?.representativeFrame.frameKey).toBe(
      "tilesets.farmrpg.water.tile#0",
    );
    expect(winterWater?.animationFrames).toHaveLength(1);
    expect(winterWater?.animationFrames[0]?.frameKey).toBe(
      "tilesets.farmrpg.water.tile#0@0",
    );
  });
});

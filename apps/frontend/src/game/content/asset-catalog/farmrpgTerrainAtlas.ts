import atlasDataJson from "public-assets-json:farmrpg/atlases/tilesets.json";

export type FarmrpgTerrainAtlasData = {
  meta: { size: { w: number; h: number } };
  frames: Record<
    string,
    { frame: { x: number; y: number; w: number; h: number } }
  >;
};

export const FARMRPG_TERRAIN_ATLAS_IMAGE_URL =
  "/assets/farmrpg/atlases/tilesets.png";
export const FARMRPG_TERRAIN_ATLAS_W = (
  atlasDataJson as FarmrpgTerrainAtlasData
).meta.size.w;
export const FARMRPG_TERRAIN_ATLAS_H = (
  atlasDataJson as FarmrpgTerrainAtlasData
).meta.size.h;
export const FARMRPG_TERRAIN_ATLAS_FRAMES = (
  atlasDataJson as FarmrpgTerrainAtlasData
).frames;

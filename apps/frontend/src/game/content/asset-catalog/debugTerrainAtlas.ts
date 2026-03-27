import atlasDataJson from "public-assets-json:debug/atlas.json";

export type DebugTerrainAtlasData = {
  meta: {
    size: { w: number; h: number };
  };
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
};

export const DEBUG_TERRAIN_ATLAS_IMAGE_URL = "/assets/debug/atlas.png";
export const DEBUG_TERRAIN_ATLAS_W = (atlasDataJson as DebugTerrainAtlasData).meta.size.w;
export const DEBUG_TERRAIN_ATLAS_H = (atlasDataJson as DebugTerrainAtlasData).meta.size.h;

export const DEBUG_TERRAIN_ATLAS_FRAMES = (atlasDataJson as DebugTerrainAtlasData).frames as Record<
  string,
  { frame: { x: number; y: number; w: number; h: number } }
>;

export function getDebugTerrainAtlasFrame(
  frameKey: string,
): { frame: { x: number; y: number; w: number; h: number } } | undefined {
  return DEBUG_TERRAIN_ATLAS_FRAMES[frameKey];
}

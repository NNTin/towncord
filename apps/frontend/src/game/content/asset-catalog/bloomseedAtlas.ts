import atlasDataJson from "public-assets-json:bloomseed/atlas.json";

type AtlasFrame = { x: number; y: number; w: number; h: number };

type BloomseedAtlasData = {
  meta: { size: { w: number; h: number } };
  frames: Record<string, { frame: AtlasFrame }>;
};

export const BLOOMSEED_ATLAS_IMAGE_URL = "/assets/bloomseed/atlas.png";

const atlasData = atlasDataJson as BloomseedAtlasData;
export const BLOOMSEED_ATLAS_W = atlasData.meta.size.w;
export const BLOOMSEED_ATLAS_H = atlasData.meta.size.h;

export function getBloomseedAtlasFrame(frameKey: string): AtlasFrame | null {
  return atlasData.frames[frameKey]?.frame ?? null;
}

import atlasDataJson from "public-assets-json:farmrpg/atlas.json";

type AtlasFrame = { x: number; y: number; w: number; h: number };

type FarmrpgAtlasData = {
  meta: { size: { w: number; h: number } };
  frames: Record<string, { frame: AtlasFrame }>;
};

export const FARMRPG_ATLAS_IMAGE_URL = "/assets/farmrpg/atlas.png";

const atlasData = atlasDataJson as FarmrpgAtlasData;
export const FARMRPG_ATLAS_W = atlasData.meta.size.w;
export const FARMRPG_ATLAS_H = atlasData.meta.size.h;

export function getFarmrpgAtlasFrame(frameKey: string): AtlasFrame | null {
  return atlasData.frames[frameKey]?.frame ?? null;
}

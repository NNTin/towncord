import atlasDataJson from "public-assets-json:donarg-office/atlas.json";

type AtlasFrame = { x: number; y: number; w: number; h: number };

export type DonargOfficeAtlasData = {
  meta: {
    size: { w: number; h: number };
  };
  frames: Record<string, { frame: AtlasFrame }>;
};

export const DONARG_OFFICE_ATLAS_IMAGE_URL = "/assets/donarg-office/atlas.png";

export const donargOfficeAtlasData = atlasDataJson as DonargOfficeAtlasData;
export const DONARG_OFFICE_ATLAS_W = donargOfficeAtlasData.meta.size.w;
export const DONARG_OFFICE_ATLAS_H = donargOfficeAtlasData.meta.size.h;

export function getDonargOfficeAtlasFrame(frameKey: string): AtlasFrame | null {
  return donargOfficeAtlasData.frames[frameKey]?.frame ?? null;
}

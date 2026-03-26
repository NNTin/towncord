import atlasDataJson from "public-assets-json:donarg-office/atlas.json";

export type DonargOfficeAtlasData = {
  meta: {
    size: { w: number; h: number };
  };
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
};

export const DONARG_OFFICE_ATLAS_IMAGE_URL = "/assets/donarg-office/atlas.png";

export const donargOfficeAtlasData = atlasDataJson as DonargOfficeAtlasData;
import {
  DONARG_OFFICE_ATLAS_IMAGE_URL,
  donargOfficeAtlasData,
} from "../asset-catalog/donargOfficeAtlas";

const atlasData = donargOfficeAtlasData;

export const ENVIRONMENT_ATLAS_IMAGE_URL = DONARG_OFFICE_ATLAS_IMAGE_URL;
export const ENVIRONMENT_ATLAS_W = atlasData.meta.size.w;
export const ENVIRONMENT_ATLAS_H = atlasData.meta.size.h;

// All environment frames keyed by frame name — used by UI components for CSS sprite rendering
export const ENVIRONMENT_ATLAS_FRAMES = atlasData.frames as Record<
  string,
  { frame: { x: number; y: number; w: number; h: number } }
>;

// Floor palette: one entry per floor pattern in the atlas (pattern-01 through pattern-07)
type FloorPatternItem = {
  id: string;            // e.g. "environment.floors.pattern-01"
  frameKey: string;      // e.g. "environment.floors.pattern-01#0"
  atlasFrame: { x: number; y: number; w: number; h: number };
};

export const FLOOR_PATTERN_ITEMS: FloorPatternItem[] = (() => {
  const frames = atlasData.frames as Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  const items: FloorPatternItem[] = [];
  for (let i = 1; i <= 7; i++) {
    const frameKey = `environment.floors.pattern-0${i}#0`;
    const entry = frames[frameKey];
    if (!entry) continue;
    items.push({ id: `environment.floors.pattern-0${i}`, frameKey, atlasFrame: entry.frame });
  }
  return items;
})();

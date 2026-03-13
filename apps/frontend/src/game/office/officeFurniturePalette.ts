import furnitureCatalogData from "../../../../../packages/donarg-office-assets/assets/furniture/furniture-catalog.json";
import atlasData from "../../../../../apps/frontend/public/assets/donarg-office/atlas.json";

export type FurniturePaletteItem = {
  id: string;
  label: string;
  category: string;
  atlasFrame: { x: number; y: number; w: number; h: number };
};

export const ATLAS_IMAGE_URL = "/assets/donarg-office/atlas.png";
export const ATLAS_W = atlasData.meta.size.w;
export const ATLAS_H = atlasData.meta.size.h;

const ORIENTATION_ORDER = ["front", "right", "back", "left"] as const;

function filePathToAtlasKey(filePath: string): string {
  const withoutExt = filePath.replace(/\.png$/, "");
  const parts = withoutExt.split("/");
  const name = parts[parts.length - 1]!.toLowerCase().replace(/_/g, "-");
  const category = parts[parts.length - 2]!.toLowerCase();
  return `furniture.${category}.${name}#0`;
}

type RawAsset = (typeof furnitureCatalogData.assets)[number];

function buildVisibleItems(): FurniturePaletteItem[] {
  const assets = furnitureCatalogData.assets as RawAsset[];
  const frames = atlasData.frames as Record<string, { frame: { x: number; y: number; w: number; h: number } }>;

  // Build orientation groups: groupId -> orientation -> id
  // Only use "off" state (or no state) variants to determine the primary orientation
  const orientationGroups = new Map<string, Map<string, string>>();
  for (const asset of assets) {
    if (!asset.groupId || !("orientation" in asset) || !asset.orientation) continue;
    if ("state" in asset && asset.state && asset.state !== "off") continue;
    const map = orientationGroups.get(asset.groupId) ?? new Map<string, string>();
    map.set(asset.orientation, asset.id);
    orientationGroups.set(asset.groupId, map);
  }

  const hidden = new Set<string>();

  // Hide non-primary orientations in rotation groups
  for (const orientMap of orientationGroups.values()) {
    if (orientMap.size < 2) continue;
    const primary = ORIENTATION_ORDER.find((o) => orientMap.has(o)) ?? [...orientMap.keys()][0]!;
    for (const [orientation, id] of orientMap) {
      if (orientation !== primary) hidden.add(id);
    }
  }

  // Hide "on" state variants
  for (const asset of assets) {
    if ("state" in asset && asset.state === "on") hidden.add(asset.id);
  }

  const result: FurniturePaletteItem[] = [];
  for (const asset of assets) {
    if (hidden.has(asset.id)) continue;
    const atlasKey = filePathToAtlasKey(asset.file);
    const frameData = frames[atlasKey];
    if (!frameData) continue;
    result.push({
      id: asset.id,
      label: asset.label,
      category: asset.category,
      atlasFrame: frameData.frame,
    });
  }

  return result;
}

export const FURNITURE_PALETTE_ITEMS: FurniturePaletteItem[] = buildVisibleItems();
export const FURNITURE_PALETTE_CATEGORIES: string[] = [
  ...new Set(FURNITURE_PALETTE_ITEMS.map((i) => i.category)),
].sort();

import furnitureCatalogData from "../../../../../packages/donarg-office-assets/assets/furniture/furniture-catalog.json";
import atlasData from "../../../../../apps/frontend/public/assets/donarg-office/atlas.json";

export type FurniturePalettePlacement = "floor" | "wall" | "surface";

export type FurniturePaletteItem = {
  id: string;
  label: string;
  category: string;
  atlasKey: string;
  atlasFrame: { x: number; y: number; w: number; h: number };
  footprintW: number;
  footprintH: number;
  placement: FurniturePalettePlacement;
  color: number;
  accentColor: number;
};

export const ATLAS_IMAGE_URL = "/assets/donarg-office/atlas.png";
export const ATLAS_W = atlasData.meta.size.w;
export const ATLAS_H = atlasData.meta.size.h;

const DONARG_TILE_WORLD_SIZE = 16;
const ORIENTATION_ORDER = ["front", "right", "back", "left"] as const;

function filePathToAtlasKey(filePath: string): string {
  const withoutExt = filePath.replace(/\.png$/, "");
  const parts = withoutExt.split("/");
  const name = parts[parts.length - 1]!.toLowerCase().replace(/_/g, "-");
  const category = parts[parts.length - 2]!.toLowerCase();
  return `furniture.${category}.${name}#0`;
}

function fallbackFootprintFromPixels(pixels?: number): number {
  if (!Number.isFinite(pixels)) {
    return 1;
  }

  return Math.max(1, Math.ceil((pixels as number) / DONARG_TILE_WORLD_SIZE));
}

function resolvePlacement(asset: RawAsset): FurniturePalettePlacement {
  if ("canPlaceOnWalls" in asset && asset.canPlaceOnWalls) return "wall";
  if ("canPlaceOnSurfaces" in asset && asset.canPlaceOnSurfaces) return "surface";
  return "floor";
}

function resolveColors(asset: RawAsset): { color: number; accentColor: number } {
  const label = asset.label?.toLowerCase() ?? "";
  const category = asset.category?.toLowerCase() ?? "";

  if (label.includes("plant")) return { color: 0x166534, accentColor: 0x86efac };
  if (label.includes("fridge")) return { color: 0xe5e7eb, accentColor: 0x94a3b8 };
  if (label.includes("vending")) return { color: 0x4338ca, accentColor: 0xc4b5fd };
  if (
    label.includes("computer") ||
    label.includes("laptop") ||
    label.includes("monitor") ||
    label.includes("server") ||
    label.includes("telephone")
  ) {
    return { color: 0x334155, accentColor: 0x93c5fd };
  }

  switch (category) {
    case "chairs":
      return label.includes("cushioned")
        ? { color: 0x1d4ed8, accentColor: 0xbfdbfe }
        : { color: 0x92400e, accentColor: 0xfcd34d };
    case "decor":
      return { color: 0x0f766e, accentColor: 0x99f6e4 };
    case "desks":
      return label.includes("white")
        ? { color: 0xe2e8f0, accentColor: 0x94a3b8 }
        : { color: 0x8b5a2b, accentColor: 0xf4a261 };
    case "misc":
      return { color: 0x9a3412, accentColor: 0xfdba74 };
    case "storage":
      return { color: 0x475569, accentColor: 0xcbd5e1 };
    case "wall":
      return { color: 0xf8fafc, accentColor: 0xf59e0b };
    default:
      return { color: 0x64748b, accentColor: 0xe2e8f0 };
  }
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

    const footprintW = Math.max(
      1,
      ("footprintW" in asset && typeof asset.footprintW === "number"
        ? asset.footprintW
        : fallbackFootprintFromPixels("width" in asset && typeof asset.width === "number" ? asset.width : undefined)),
    );
    const footprintH = Math.max(
      1,
      ("footprintH" in asset && typeof asset.footprintH === "number"
        ? asset.footprintH
        : fallbackFootprintFromPixels("height" in asset && typeof asset.height === "number" ? asset.height : undefined)),
    );

    result.push({
      id: asset.id,
      label: asset.label,
      category: asset.category,
      atlasKey,
      atlasFrame: frameData.frame,
      footprintW,
      footprintH,
      placement: resolvePlacement(asset),
      ...resolveColors(asset),
    });
  }

  return result;
}

export const FURNITURE_PALETTE_ITEMS: FurniturePaletteItem[] = buildVisibleItems();
export const FURNITURE_PALETTE_CATEGORIES: string[] = [
  ...new Set(FURNITURE_PALETTE_ITEMS.map((i) => i.category)),
].sort();

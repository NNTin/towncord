import {
  DONARG_OFFICE_ATLAS_IMAGE_URL,
  donargOfficeAtlasData,
} from "../asset-catalog/donargOfficeAtlas";
import {
  donargFurnitureCatalogData,
  type DonargFurnitureCatalogAsset,
} from "../asset-catalog/donargOfficeFurnitureCatalog";

const atlasData = donargOfficeAtlasData;
const furnitureCatalogData = donargFurnitureCatalogData;
export const FURNITURE_ATLAS_TEXTURE_KEY = "donarg.office.furniture";

export type FurniturePalettePlacement = "floor" | "wall" | "surface";
export type FurnitureRotationQuarterTurns = 0 | 1 | 2 | 3;

export type FurniturePaletteItem = {
  id: string;
  label: string;
  category: string;
  groupId?: string;
  orientation?: string;
  state?: string;
  textureKey: string;
  atlasKey: string;
  atlasFrame: { x: number; y: number; w: number; h: number };
  footprintW: number;
  footprintH: number;
  placement: FurniturePalettePlacement;
  color: number;
  accentColor: number;
};

export const ATLAS_IMAGE_URL = DONARG_OFFICE_ATLAS_IMAGE_URL;
export const ATLAS_W = atlasData.meta.size.w;
export const ATLAS_H = atlasData.meta.size.h;

const DONARG_TILE_WORLD_SIZE = 16;
const ORIENTATION_ORDER = ["front", "right", "back", "left"] as const;
const FURNITURE_ROTATION_QUARTER_TURNS = [0, 1, 2, 3] as const;

function filePathToAtlasKey(filePath: string): string {
  const withoutExt = filePath.replace(/\.png$/, "");
  const parts = withoutExt.split("/");
  const name = parts[parts.length - 1]!.toLowerCase().replace(/_/g, "-");
  const category = parts[parts.length - 2]!.toLowerCase();
  return `furniture.${category}.${name}#0`;
}

export function fallbackFootprintFromPixels(pixels?: number): number {
  if (!Number.isFinite(pixels)) {
    return 1;
  }

  return Math.max(1, Math.ceil((pixels as number) / DONARG_TILE_WORLD_SIZE));
}

function resolvePlacement(asset: RawAsset): FurniturePalettePlacement {
  if ("canPlaceOnWalls" in asset && asset.canPlaceOnWalls) return "wall";
  if ("canPlaceOnSurfaces" in asset && asset.canPlaceOnSurfaces)
    return "surface";
  return "floor";
}

function resolveColors(asset: RawAsset): {
  color: number;
  accentColor: number;
} {
  const label = asset.label?.toLowerCase() ?? "";
  const category = asset.category?.toLowerCase() ?? "";

  if (label.includes("plant"))
    return { color: 0x166534, accentColor: 0x86efac };
  if (label.includes("fridge"))
    return { color: 0xe5e7eb, accentColor: 0x94a3b8 };
  if (label.includes("vending"))
    return { color: 0x4338ca, accentColor: 0xc4b5fd };
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

type RawAsset = DonargFurnitureCatalogAsset;

function buildItemsFromAssets(assets: RawAsset[]): FurniturePaletteItem[] {
  const frames = atlasData.frames as Record<
    string,
    { frame: { x: number; y: number; w: number; h: number } }
  >;
  const result: FurniturePaletteItem[] = [];

  for (const asset of assets) {
    const atlasKey = filePathToAtlasKey(asset.file);
    const frameData = frames[atlasKey];
    if (!frameData) continue;

    const footprintW = Math.max(
      1,
      "footprintW" in asset && typeof asset.footprintW === "number"
        ? asset.footprintW
        : fallbackFootprintFromPixels(
            "width" in asset && typeof asset.width === "number"
              ? asset.width
              : undefined,
          ),
    );
    const footprintH = Math.max(
      1,
      "footprintH" in asset && typeof asset.footprintH === "number"
        ? asset.footprintH
        : fallbackFootprintFromPixels(
            "height" in asset && typeof asset.height === "number"
              ? asset.height
              : undefined,
          ),
    );

    result.push({
      id: asset.id,
      label: asset.label,
      category: asset.category,
      textureKey: FURNITURE_ATLAS_TEXTURE_KEY,
      atlasKey,
      atlasFrame: frameData.frame,
      footprintW,
      footprintH,
      placement: resolvePlacement(asset),
      ...(asset.groupId ? { groupId: asset.groupId } : {}),
      ...(asset.orientation ? { orientation: asset.orientation } : {}),
      ...(asset.state ? { state: asset.state } : {}),
      ...resolveColors(asset),
    });
  }

  return result;
}

function buildAllItems(): FurniturePaletteItem[] {
  return buildItemsFromAssets(furnitureCatalogData.assets as RawAsset[]);
}

function buildVisibleItems(): FurniturePaletteItem[] {
  const assets = furnitureCatalogData.assets as RawAsset[];

  // Build orientation groups: groupId -> orientation -> id
  // Only use "off" state (or no state) variants to determine the primary orientation
  const orientationGroups = new Map<string, Map<string, string>>();
  for (const asset of assets) {
    if (!asset.groupId || !("orientation" in asset) || !asset.orientation)
      continue;
    if ("state" in asset && asset.state && asset.state !== "off") continue;
    const map =
      orientationGroups.get(asset.groupId) ?? new Map<string, string>();
    map.set(asset.orientation, asset.id);
    orientationGroups.set(asset.groupId, map);
  }

  const hidden = new Set<string>();

  // Hide non-primary orientations in rotation groups
  for (const orientMap of orientationGroups.values()) {
    if (orientMap.size < 2) continue;
    const primary =
      ORIENTATION_ORDER.find((o) => orientMap.has(o)) ??
      [...orientMap.keys()][0]!;
    for (const [orientation, id] of orientMap) {
      if (orientation !== primary) hidden.add(id);
    }
  }

  // Hide "on" state variants
  for (const asset of assets) {
    if ("state" in asset && asset.state === "on") hidden.add(asset.id);
  }

  return buildItemsFromAssets(assets.filter((asset) => !hidden.has(asset.id)));
}

function resolveFurnitureItemById(
  id: string | null | undefined,
): FurniturePaletteItem | null {
  if (!id) {
    return null;
  }

  return FURNITURE_ALL_ITEMS.find((item) => item.id === id) ?? null;
}

function resolveNextRotatedFurnitureVariant(
  currentItem: FurniturePaletteItem | null,
): FurniturePaletteItem | null {
  if (!currentItem?.groupId || !currentItem.orientation) {
    return currentItem;
  }

  const candidates = FURNITURE_ALL_ITEMS.filter(
    (item) => item.groupId === currentItem.groupId,
  );
  if (candidates.length < 2) {
    return currentItem;
  }

  const currentState = currentItem.state ?? null;
  const currentIndex = ORIENTATION_ORDER.indexOf(
    currentItem.orientation as (typeof ORIENTATION_ORDER)[number],
  );
  if (currentIndex < 0) {
    return currentItem;
  }

  for (let offset = 1; offset <= ORIENTATION_ORDER.length; offset += 1) {
    const nextOrientation =
      ORIENTATION_ORDER[(currentIndex + offset) % ORIENTATION_ORDER.length];
    const nextItem =
      candidates.find(
        (item) =>
          item.orientation === nextOrientation &&
          (item.state ?? null) === currentState,
      ) ?? candidates.find((item) => item.orientation === nextOrientation);

    if (nextItem) {
      return nextItem;
    }
  }

  return currentItem;
}

export function canRotateFurniturePaletteItem(
  id: string | null | undefined,
): boolean {
  const currentItem = resolveFurnitureItemById(id);
  if (!currentItem) {
    return false;
  }

  const nextItem = resolveNextRotatedFurnitureVariant(currentItem);
  return Boolean(nextItem && nextItem.id !== currentItem.id);
}

export function resolveFurnitureRotationVariant(
  id: string | null | undefined,
  quarterTurns: FurnitureRotationQuarterTurns = 0,
): FurniturePaletteItem | null {
  let currentItem = resolveFurnitureItemById(id);
  if (!currentItem) {
    return null;
  }

  if (!FURNITURE_ROTATION_QUARTER_TURNS.includes(quarterTurns)) {
    return currentItem;
  }

  for (let step = 0; step < quarterTurns; step += 1) {
    currentItem = resolveNextRotatedFurnitureVariant(currentItem);
  }

  return currentItem;
}

/** All furniture items with atlas frames, including non-primary orientations. Used for rendering placed furniture. */
export const FURNITURE_ALL_ITEMS: FurniturePaletteItem[] = buildAllItems();
export const FURNITURE_PALETTE_ITEMS: FurniturePaletteItem[] =
  buildVisibleItems();
export const FURNITURE_PALETTE_CATEGORIES: string[] = [
  ...new Set(FURNITURE_PALETTE_ITEMS.map((i) => i.category)),
].sort();

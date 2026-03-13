import type {
  OfficeCatalogCategory,
  OfficeFurnitureCatalogAsset,
  OfficeFurnitureCatalogEntry,
} from "./model";

type RotationGroup = {
  orientations: string[];
  members: Record<string, string>;
};

export type OfficeFurnitureCatalogIndex = {
  byType: Map<string, OfficeFurnitureCatalogEntry>;
  visibleTypes: string[];
  categories: OfficeCatalogCategory[];
  rotationGroupByType: Map<string, RotationGroup>;
  toggledTypeByType: Map<string, string>;
};

const ORIENTATION_ORDER = ["front", "right", "back", "left"] as const;

function toCatalogEntry(asset: OfficeFurnitureCatalogAsset): OfficeFurnitureCatalogEntry {
  return {
    type: asset.id,
    label: asset.label,
    category: asset.category,
    footprintW: asset.footprintW,
    footprintH: asset.footprintH,
    isDesk: asset.isDesk,
    ...(asset.orientation ? { orientation: asset.orientation } : {}),
    ...(asset.state ? { state: asset.state } : {}),
    ...(asset.canPlaceOnSurfaces ? { canPlaceOnSurfaces: true } : {}),
    ...(asset.backgroundTiles ? { backgroundTiles: asset.backgroundTiles } : {}),
    ...(asset.canPlaceOnWalls ? { canPlaceOnWalls: true } : {}),
  };
}

export function buildOfficeFurnitureCatalogIndex(
  assets: readonly OfficeFurnitureCatalogAsset[],
): OfficeFurnitureCatalogIndex {
  const byType = new Map<string, OfficeFurnitureCatalogEntry>();
  const rotationGroupByType = new Map<string, RotationGroup>();
  const toggledTypeByType = new Map<string, string>();

  for (const asset of assets) {
    byType.set(asset.id, toCatalogEntry(asset));
  }

  const groupOrientations = new Map<string, Map<string, string>>();
  for (const asset of assets) {
    if (!asset.groupId || !asset.orientation) continue;
    if (asset.state && asset.state !== "off") continue;

    const orientMap = groupOrientations.get(asset.groupId) ?? new Map<string, string>();
    orientMap.set(asset.orientation, asset.id);
    groupOrientations.set(asset.groupId, orientMap);
  }

  const hiddenTypes = new Set<string>();
  for (const orientMap of groupOrientations.values()) {
    const orientations = ORIENTATION_ORDER.filter((orientation) => orientMap.has(orientation));
    if (orientations.length < 2) continue;

    const members: Record<string, string> = {};
    for (const orientation of orientations) {
      members[orientation] = orientMap.get(orientation)!;
    }

    const group: RotationGroup = { orientations: [...orientations], members };
    for (const type of Object.values(members)) {
      rotationGroupByType.set(type, group);
    }

    const primaryType = members[orientations[0]!]!;
    for (const type of Object.values(members)) {
      if (type !== primaryType) hiddenTypes.add(type);
    }
  }

  const statePairs = new Map<string, Map<string, string>>();
  for (const asset of assets) {
    if (!asset.groupId || !asset.state) continue;
    const key = `${asset.groupId}|${asset.orientation ?? ""}`;
    const pair = statePairs.get(key) ?? new Map<string, string>();
    pair.set(asset.state, asset.id);
    statePairs.set(key, pair);
  }

  const onStateTypes = new Set<string>();
  for (const pair of statePairs.values()) {
    const onType = pair.get("on");
    const offType = pair.get("off");
    if (!onType || !offType) continue;

    toggledTypeByType.set(onType, offType);
    toggledTypeByType.set(offType, onType);
    onStateTypes.add(onType);
  }

  const visibleTypes = [...byType.keys()]
    .filter((type) => !hiddenTypes.has(type) && !onStateTypes.has(type))
    .sort((a, b) => {
      const aEntry = byType.get(a)!;
      const bEntry = byType.get(b)!;
      if (aEntry.category !== bEntry.category) return aEntry.category.localeCompare(bEntry.category);
      return aEntry.label.localeCompare(bEntry.label);
    });

  const categories = [...new Set(visibleTypes.map((type) => byType.get(type)!.category))].sort();

  return {
    byType,
    visibleTypes,
    categories,
    rotationGroupByType,
    toggledTypeByType,
  };
}

export function getFurnitureCatalogEntry(
  index: OfficeFurnitureCatalogIndex,
  type: string,
): OfficeFurnitureCatalogEntry | null {
  return index.byType.get(type) ?? null;
}

export function getVisibleFurnitureTypesForCategory(
  index: OfficeFurnitureCatalogIndex,
  category: OfficeCatalogCategory,
): string[] {
  return index.visibleTypes.filter((type) => index.byType.get(type)?.category === category);
}

export function getRotatedFurnitureType(
  index: OfficeFurnitureCatalogIndex,
  currentType: string,
  direction: "cw" | "ccw",
): string | null {
  const group = index.rotationGroupByType.get(currentType);
  if (!group) return null;

  const order = group.orientations.map((orientation) => group.members[orientation]!);
  const currentIndex = order.indexOf(currentType);
  if (currentIndex === -1) return null;

  const delta = direction === "cw" ? 1 : -1;
  const nextIndex = (currentIndex + delta + order.length) % order.length;
  return order[nextIndex] ?? null;
}

export function getToggledFurnitureType(
  index: OfficeFurnitureCatalogIndex,
  currentType: string,
): string | null {
  return index.toggledTypeByType.get(currentType) ?? null;
}

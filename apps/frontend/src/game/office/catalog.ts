import type {
  OfficeCatalog,
  OfficeFurnitureAsset,
  OfficeFurnitureCatalogEntry,
} from "./model";

const ORIENTATION_ORDER = ["front", "right", "back", "left"] as const;

function toCatalogEntry(asset: OfficeFurnitureAsset): OfficeFurnitureCatalogEntry {
  return {
    type: asset.id,
    label: asset.label,
    category: asset.category,
    footprintW: asset.footprintW,
    footprintH: asset.footprintH,
    isDesk: asset.isDesk,
    canPlaceOnWalls: asset.canPlaceOnWalls ?? false,
    canPlaceOnSurfaces: asset.canPlaceOnSurfaces ?? false,
    backgroundTiles: asset.backgroundTiles ?? 0,
    ...(asset.groupId ? { groupId: asset.groupId } : {}),
    ...(asset.orientation ? { orientation: asset.orientation } : {}),
    ...(asset.state ? { state: asset.state } : {}),
  };
}

function stripGroupedVariantLabel(label: string): string {
  return label
    .replace(/ - Front - Off$/u, "")
    .replace(/ - Front$/u, "")
    .replace(/ - Off$/u, "");
}

export function buildOfficeCatalog(
  assets: readonly OfficeFurnitureAsset[],
): OfficeCatalog {
  const byType = new Map<string, OfficeFurnitureCatalogEntry>();
  const rotationOrderByType = new Map<string, readonly string[]>();
  const statePartnerByType = new Map<string, string>();

  const allEntries = assets.map(toCatalogEntry);
  for (const entry of allEntries) {
    byType.set(entry.type, entry);
  }

  const orientationByGroup = new Map<string, Map<string, string>>();
  for (const asset of assets) {
    if (!asset.groupId || !asset.orientation) continue;
    if (asset.state && asset.state !== "off") continue;

    let group = orientationByGroup.get(asset.groupId);
    if (!group) {
      group = new Map<string, string>();
      orientationByGroup.set(asset.groupId, group);
    }
    group.set(asset.orientation, asset.id);
  }

  const hiddenVisibleTypes = new Set<string>();

  for (const orientationMap of orientationByGroup.values()) {
    const orderedTypes = ORIENTATION_ORDER
      .map((orientation) => orientationMap.get(orientation))
      .filter((type): type is string => Boolean(type));
    if (orderedTypes.length < 2) continue;

    for (const type of orderedTypes) {
      rotationOrderByType.set(type, orderedTypes);
    }

    orderedTypes.slice(1).forEach((type) => hiddenVisibleTypes.add(type));
  }

  const stateByGroupOrientation = new Map<string, Map<string, string>>();
  for (const asset of assets) {
    if (!asset.groupId || !asset.state) continue;
    const key = `${asset.groupId}|${asset.orientation ?? ""}`;
    let stateMap = stateByGroupOrientation.get(key);
    if (!stateMap) {
      stateMap = new Map<string, string>();
      stateByGroupOrientation.set(key, stateMap);
    }
    stateMap.set(asset.state, asset.id);
  }

  for (const stateMap of stateByGroupOrientation.values()) {
    const onType = stateMap.get("on");
    const offType = stateMap.get("off");
    if (!onType || !offType) continue;
    statePartnerByType.set(onType, offType);
    statePartnerByType.set(offType, onType);
    hiddenVisibleTypes.add(onType);
  }

  for (const asset of assets) {
    if (!asset.groupId || asset.state !== "on" || !asset.orientation) continue;
    const offType = statePartnerByType.get(asset.id);
    if (!offType) continue;

    const offRotationOrder = rotationOrderByType.get(offType);
    if (!offRotationOrder || offRotationOrder.length < 2) continue;

    const onRotationOrder = offRotationOrder.map(
      (memberType) => statePartnerByType.get(memberType) ?? memberType,
    );
    for (const type of onRotationOrder) {
      if (!rotationOrderByType.has(type)) {
        rotationOrderByType.set(type, onRotationOrder);
      }
    }
  }

  const visibleTypesByCategory = new Map<string, string[]>();

  for (const entry of allEntries) {
    if (hiddenVisibleTypes.has(entry.type)) continue;

    const visibleEntry: OfficeFurnitureCatalogEntry = {
      ...entry,
      label:
        rotationOrderByType.has(entry.type) || statePartnerByType.has(entry.type)
          ? stripGroupedVariantLabel(entry.label)
          : entry.label,
    };
    byType.set(visibleEntry.type, visibleEntry);

    let types = visibleTypesByCategory.get(visibleEntry.category);
    if (!types) {
      types = [];
      visibleTypesByCategory.set(visibleEntry.category, types);
    }
    types.push(visibleEntry.type);
  }

  for (const [category, types] of visibleTypesByCategory) {
    visibleTypesByCategory.set(category, [...types].sort());
  }

  return {
    byType,
    visibleTypesByCategory,
    visibleCategories: [...visibleTypesByCategory.keys()].sort(),
    rotationOrderByType,
    statePartnerByType,
  };
}

export function getOfficeFurnitureEntry(
  catalog: OfficeCatalog,
  type: string,
): OfficeFurnitureCatalogEntry | undefined {
  return catalog.byType.get(type);
}

export function listVisibleOfficeFurnitureTypes(
  catalog: OfficeCatalog,
  category: string,
): readonly string[] {
  return catalog.visibleTypesByCategory.get(category) ?? [];
}

export function getRotatedOfficeFurnitureType(
  catalog: OfficeCatalog,
  currentType: string,
  direction: "cw" | "ccw",
): string | null {
  const order = catalog.rotationOrderByType.get(currentType);
  if (!order || order.length < 2) return null;

  const index = order.indexOf(currentType);
  if (index < 0) return null;

  const nextIndex =
    direction === "cw"
      ? (index + 1) % order.length
      : (index - 1 + order.length) % order.length;

  return order[nextIndex] ?? null;
}

export function getToggledOfficeFurnitureType(
  catalog: OfficeCatalog,
  currentType: string,
): string | null {
  return catalog.statePartnerByType.get(currentType) ?? null;
}


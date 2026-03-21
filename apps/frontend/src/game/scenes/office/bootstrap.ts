import officeLayoutDataJson from "public-assets-json:donarg-office/default-layout.json";
import furnitureCatalogDataJson from "public-assets-json:donarg-office/furniture-catalog.json";
import { fallbackFootprintFromPixels } from "../../office/officeFurniturePalette";
import {
  cloneOfficeColorAdjust,
  isOfficeColorAdjust,
  resolveOfficeTileTint,
  type OfficeColorAdjust,
} from "./colors";

export const OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY = "officeSceneBootstrap";

const DONARG_TILE_WORLD_SIZE = 16;
const MAX_DERIVED_CHARACTERS = 6;
const WALL_TILE_IDS = new Set([8]);
const FLOOR_TILE_IDS = new Set([0, 1, 2, 6]);
const CHARACTER_NAMES = ["Ari", "Bea", "Cai", "Dia", "Eli", "Faye"] as const;
const CHARACTER_PALETTE = [
  { color: 0x2563eb, accentColor: 0xbfdbfe },
  { color: 0xdb2777, accentColor: 0xfbcfe8 },
  { color: 0x059669, accentColor: 0xa7f3d0 },
  { color: 0xd97706, accentColor: 0xfde68a },
  { color: 0x7c3aed, accentColor: 0xddd6fe },
  { color: 0xea580c, accentColor: 0xfdba74 },
] as const;

type DonargLayoutColor = {
  h: number;
  s: number;
  b: number;
  c: number;
  colorize?: boolean;
};

type DonargLayoutPlacement = {
  uid: string;
  type: string;
  col: number;
  row: number;
};

type DonargOfficeLayoutSource = {
  version: number;
  cols: number;
  rows: number;
  tiles: Array<number | OfficeSceneTile>;
  tileColors?: Array<DonargLayoutColor | null>;
  furniture: DonargLayoutPlacement[];
};

type DonargFurnitureAssetSource = {
  id: string;
  label?: string;
  category?: string;
  width?: number;
  height?: number;
  footprintW?: number;
  footprintH?: number;
  canPlaceOnWalls?: boolean;
  canPlaceOnSurfaces?: boolean;
  groupId?: string;
  orientation?: string;
  state?: string;
};

type DonargFurnitureCatalogSource = {
  assets: DonargFurnitureAssetSource[];
};

export type OfficeSceneTileKind = "void" | "floor" | "wall";

export type OfficeSceneTile = {
  kind: OfficeSceneTileKind;
  tileId: number;
  tint?: number;
  colorAdjust?: OfficeColorAdjust | null;
  /** Atlas frame ID prefix for the floor pattern, e.g. "environment.floors.pattern-02". Defaults to pattern-01 when absent. */
  pattern?: string;
};

export type OfficeSceneFurnitureCategory =
  | "chairs"
  | "decor"
  | "desks"
  | "electronics"
  | "misc"
  | "storage"
  | "wall"
  | "unknown";

export type OfficeSceneFurniturePlacement = "floor" | "surface" | "wall";

export type OfficeSceneFurniture = {
  id: string;
  assetId: string;
  label: string;
  category: OfficeSceneFurnitureCategory;
  placement: OfficeSceneFurniturePlacement;
  col: number;
  row: number;
  width: number;
  height: number;
  color: number;
  accentColor: number;
};

export type OfficeSceneCharacter = {
  id: string;
  label: string;
  glyph: string;
  col: number;
  row: number;
  color: number;
  accentColor: number;
};

export type OfficeSceneLayout = {
  cols: number;
  rows: number;
  cellSize: number;
  tiles: OfficeSceneTile[];
  furniture: OfficeSceneFurniture[];
  characters: OfficeSceneCharacter[];
};

type OfficeSceneBootstrap = {
  layout: OfficeSceneLayout;
};

type MappedFurnitureEntry = OfficeSceneFurniture & {
  sourceOrder: number;
  orientation?: string;
  groupId?: string;
};

const OFFICE_SCENE_BOOTSTRAP = buildOfficeSceneBootstrap(
  officeLayoutDataJson as DonargOfficeLayoutSource,
  furnitureCatalogDataJson as DonargFurnitureCatalogSource,
);

export function createOfficeSceneBootstrap(): OfficeSceneBootstrap {
  return { layout: structuredClone(OFFICE_SCENE_BOOTSTRAP.layout) };
}

function buildOfficeSceneBootstrap(
  sourceLayout: DonargOfficeLayoutSource,
  sourceCatalog: DonargFurnitureCatalogSource,
): OfficeSceneBootstrap {
  const catalog = new Map(sourceCatalog.assets.map((asset) => [asset.id, asset]));
  const tiles: OfficeSceneTile[] = sourceLayout.tiles.map((tile, index) =>
    normalizeOfficeSceneTile(tile, index, sourceLayout),
  );

  const furnitureRaw = (sourceLayout.furniture as unknown[]);
  const furniture: MappedFurnitureEntry[] = furnitureRaw.length > 0 && isFurnitureRecord(furnitureRaw[0])
    ? furnitureRaw.filter(isFurnitureRecord).map((f, i) => ({ ...f, sourceOrder: i }))
    : (sourceLayout.furniture as DonargLayoutPlacement[]).map((entry, index) =>
        mapFurnitureEntry(entry, catalog.get(entry.type), index),
      );

  const sourceWithChars = sourceLayout as DonargOfficeLayoutSource & { characters?: unknown[] };
  const charactersRaw = sourceWithChars.characters ?? [];
  const normalizedLayoutForCharacters =
    Array.isArray(sourceLayout.tiles) && (sourceLayout.tiles as unknown[]).length > 0 && typeof (sourceLayout.tiles as unknown[])[0] === "number"
      ? sourceLayout
      : ({
          ...sourceLayout,
          // Ensure tiles is always a number[] for character derivation.
          tiles: tiles.map((t: any) => (typeof t.tileId === "number" ? t.tileId : 0)),
        } as DonargOfficeLayoutSource);
  const characters: OfficeSceneCharacter[] = charactersRaw.length > 0 && isCharacterRecord(charactersRaw[0])
    ? charactersRaw.filter(isCharacterRecord)
    : createDerivedCharacters(normalizedLayoutForCharacters, furniture);

  return {
    layout: {
      cols: sourceLayout.cols,
      rows: sourceLayout.rows,
      cellSize: DONARG_TILE_WORLD_SIZE,
      tiles,
      furniture,
      characters,
    },
  };
}

function mapFurnitureEntry(
  entry: DonargLayoutPlacement,
  sourceAsset: DonargFurnitureAssetSource | undefined,
  sourceOrder: number,
): MappedFurnitureEntry {
  const width = Math.max(
    1,
    sourceAsset?.footprintW ?? fallbackFootprintFromPixels(sourceAsset?.width),
  );
  const height = Math.max(
    1,
    sourceAsset?.footprintH ?? fallbackFootprintFromPixels(sourceAsset?.height),
  );
  const colors = resolveFurnitureColors(sourceAsset);
  const category = normalizeFurnitureCategory(sourceAsset?.category);

  return {
    id: entry.uid,
    assetId: entry.type,
    label: sourceAsset?.label ?? entry.type,
    category,
    placement: resolveFurniturePlacement(sourceAsset),
    col: entry.col,
    row: entry.row,
    width,
    height,
    color: colors.color,
    accentColor: colors.accentColor,
    sourceOrder,
    ...(sourceAsset?.orientation ? { orientation: sourceAsset.orientation } : {}),
    ...(sourceAsset?.groupId ? { groupId: sourceAsset.groupId } : {}),
  };
}

function normalizeFurnitureCategory(
  category?: string,
): OfficeSceneFurnitureCategory {
  switch (category) {
    case "chairs":
    case "decor":
    case "desks":
    case "electronics":
    case "misc":
    case "storage":
    case "wall":
      return category;
    default:
      return "unknown";
  }
}

function resolveFurniturePlacement(
  sourceAsset?: DonargFurnitureAssetSource,
): OfficeSceneFurniturePlacement {
  if (sourceAsset?.canPlaceOnWalls) {
    return "wall";
  }

  if (sourceAsset?.canPlaceOnSurfaces) {
    return "surface";
  }

  return "floor";
}

function resolveFurnitureColors(sourceAsset?: DonargFurnitureAssetSource): {
  color: number;
  accentColor: number;
} {
  const label = sourceAsset?.label?.toLowerCase() ?? "";
  const category = normalizeFurnitureCategory(sourceAsset?.category);

  if (label.includes("plant")) {
    return {
      color: 0x166534,
      accentColor: 0x86efac,
    };
  }

  if (label.includes("fridge")) {
    return {
      color: 0xe5e7eb,
      accentColor: 0x94a3b8,
    };
  }

  if (label.includes("vending")) {
    return {
      color: 0x4338ca,
      accentColor: 0xc4b5fd,
    };
  }

  if (
    label.includes("computer") ||
    label.includes("laptop") ||
    label.includes("monitor") ||
    label.includes("server") ||
    label.includes("telephone")
  ) {
    return {
      color: 0x334155,
      accentColor: 0x93c5fd,
    };
  }

  switch (category) {
    case "chairs":
      return label.includes("cushioned")
        ? {
            color: 0x1d4ed8,
            accentColor: 0xbfdbfe,
          }
        : {
            color: 0x92400e,
            accentColor: 0xfcd34d,
          };
    case "decor":
      return {
        color: 0x0f766e,
        accentColor: 0x99f6e4,
      };
    case "desks":
      return label.includes("white")
        ? {
            color: 0xe2e8f0,
            accentColor: 0x94a3b8,
          }
        : {
            color: 0x8b5a2b,
            accentColor: 0xf4a261,
          };
    case "misc":
      return {
        color: 0x9a3412,
        accentColor: 0xfdba74,
      };
    case "storage":
      return {
        color: 0x475569,
        accentColor: 0xcbd5e1,
      };
    case "wall":
      return {
        color: 0xf8fafc,
        accentColor: 0xf59e0b,
      };
    default:
      return {
        color: 0x64748b,
        accentColor: 0xe2e8f0,
      };
  }
}

function createDerivedCharacters(
  layout: DonargOfficeLayoutSource,
  furniture: MappedFurnitureEntry[],
): OfficeSceneCharacter[] {
  const tileKindByIndex = layout.tiles.map((tile) =>
    typeof tile === "number" ? toTileKind(tile) : tile.kind,
  );
  const seatCandidates = furniture.filter(isSeatFurniture);
  const workstationCandidates = furniture.filter(isWorkstationFurniture);
  const occupiedSeats = new Set<string>();
  const characters: OfficeSceneCharacter[] = [];

  for (const station of workstationCandidates) {
    const seat = findClosestAvailableSeat(station, seatCandidates, occupiedSeats);
    if (!seat) {
      continue;
    }

    occupiedSeats.add(seat.id);
    characters.push(
      createCharacterRecord(characters.length, seat.col, seat.row),
    );

    if (characters.length >= MAX_DERIVED_CHARACTERS) {
      return characters;
    }
  }

  const fallbackAnchors = seatCandidates
    .filter((seat) => !occupiedSeats.has(seat.id))
    .sort(compareFurnitureBySourceOrder);

  for (const seat of fallbackAnchors) {
    if (!isWalkableFloor(layout, tileKindByIndex, seat.col, seat.row)) {
      continue;
    }

    characters.push(
      createCharacterRecord(characters.length, seat.col, seat.row),
    );
    if (characters.length >= MAX_DERIVED_CHARACTERS) {
      break;
    }
  }

  return characters;
}

function createCharacterRecord(
  index: number,
  col: number,
  row: number,
): OfficeSceneCharacter {
  const palette = CHARACTER_PALETTE[index % CHARACTER_PALETTE.length]!;
  const label = CHARACTER_NAMES[index % CHARACTER_NAMES.length]!;

  return {
    id: `worker-${index + 1}`,
    label,
    glyph: label.charAt(0).toUpperCase(),
    col,
    row,
    color: palette.color,
    accentColor: palette.accentColor,
  };
}

function findClosestAvailableSeat(
  anchor: MappedFurnitureEntry,
  seats: readonly MappedFurnitureEntry[],
  occupiedSeats: ReadonlySet<string>,
): MappedFurnitureEntry | null {
  const anchorPoint = getFurnitureAnchorPoint(anchor);
  const availableSeats = seats
    .filter((seat) => !occupiedSeats.has(seat.id))
    .map((seat) => ({
      seat,
      distance:
        Math.abs(seat.col - anchorPoint.col) + Math.abs(seat.row - anchorPoint.row),
    }))
    .sort((left, right) => left.distance - right.distance || compareFurnitureBySourceOrder(left.seat, right.seat));

  return availableSeats[0]?.seat ?? null;
}

function getFurnitureAnchorPoint(furniture: MappedFurnitureEntry): {
  col: number;
  row: number;
} {
  const centerCol = furniture.col + Math.floor((furniture.width - 1) / 2);
  const centerRow = furniture.row + Math.floor((furniture.height - 1) / 2);

  switch (furniture.orientation) {
    case "left":
      return {
        col: furniture.col - 1,
        row: centerRow,
      };
    case "right":
      return {
        col: furniture.col + furniture.width,
        row: centerRow,
      };
    case "front":
      return {
        col: centerCol,
        row: furniture.row + furniture.height,
      };
    case "back":
      return {
        col: centerCol,
        row: furniture.row - 1,
      };
    default:
      return {
        col: centerCol,
        row: furniture.row + furniture.height,
      };
  }
}

function compareFurnitureBySourceOrder(
  left: MappedFurnitureEntry,
  right: MappedFurnitureEntry,
): number {
  return left.sourceOrder - right.sourceOrder;
}

function isSeatFurniture(furniture: MappedFurnitureEntry): boolean {
  return furniture.category === "chairs";
}

function isWorkstationFurniture(furniture: MappedFurnitureEntry): boolean {
  if (furniture.category !== "electronics") {
    return false;
  }

  const label = furniture.label.toLowerCase();
  return (
    label.includes("laptop") ||
    label.includes("computer") ||
    label.includes("monitor")
  );
}

function isWalkableFloor(
  layout: DonargOfficeLayoutSource,
  tileKindByIndex: readonly OfficeSceneTileKind[],
  col: number,
  row: number,
): boolean {
  if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) {
    return false;
  }

  return tileKindByIndex[row * layout.cols + col] === "floor";
}

function toTileKind(tileId: number): OfficeSceneTileKind {
  if (WALL_TILE_IDS.has(tileId)) {
    return "wall";
  }

  if (FLOOR_TILE_IDS.has(tileId)) {
    return "floor";
  }

  return "void";
}

function fallbackTileTint(tileId: number): number | null {
  switch (tileId) {
    case 0:
      return 0x7c5b3b;
    case 1:
      return 0x6b7280;
    case 2:
      return 0xa16207;
    case 6:
      return 0x4b6b80;
    case 8:
      return 0x334155;
    default:
      return null;
  }
}

function isTileRecord(value: unknown): value is OfficeSceneTile {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value.kind === "void" || value.kind === "floor" || value.kind === "wall") &&
    "tileId" in value &&
    Number.isFinite((value as OfficeSceneTile).tileId) &&
    (!("tint" in value) || Number.isFinite((value as OfficeSceneTile).tint)) &&
    (!("colorAdjust" in value) ||
      (value as OfficeSceneTile).colorAdjust == null ||
      isOfficeColorAdjust((value as OfficeSceneTile).colorAdjust)) &&
    (!("pattern" in value) || typeof (value as OfficeSceneTile).pattern === "string")
  );
}

function normalizeOfficeSceneTile(
  tile: number | OfficeSceneTile,
  index: number,
  sourceLayout: DonargOfficeLayoutSource,
): OfficeSceneTile {
  if (typeof tile === "number") {
    const kind = toTileKind(tile);
    const sourceColor = sourceLayout.tileColors?.[index];
    const colorAdjust = isOfficeColorAdjust(sourceColor) ? cloneOfficeColorAdjust(sourceColor) : null;
    const tint = resolveOfficeTileTint(colorAdjust, fallbackTileTint(tile));

    const normalized: OfficeSceneTile = {
      kind,
      tileId: tile,
    };

    if (typeof tint === "number") {
      normalized.tint = tint;
    }
    if (colorAdjust) {
      normalized.colorAdjust = colorAdjust;
    }

    return normalized;
  }

  const normalized: OfficeSceneTile = {
    kind: tile.kind,
    tileId: tile.tileId,
  };

  if (typeof tile.pattern === "string") {
    normalized.pattern = tile.pattern;
  }

  const colorAdjust = isOfficeColorAdjust(tile.colorAdjust) ? cloneOfficeColorAdjust(tile.colorAdjust) : null;
  const tint = resolveOfficeTileTint(
    colorAdjust,
    typeof tile.tint === "number" ? tile.tint : fallbackTileTint(tile.tileId),
  );

  if (typeof tint === "number") {
    normalized.tint = tint;
  }
  if (colorAdjust) {
    normalized.colorAdjust = colorAdjust;
  }

  return normalized;
}

function isFurnitureRecord(value: unknown): value is OfficeSceneFurniture {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as OfficeSceneFurniture).id === "string" &&
    typeof (value as OfficeSceneFurniture).assetId === "string" &&
    typeof (value as OfficeSceneFurniture).label === "string" &&
    typeof (value as OfficeSceneFurniture).category === "string" &&
    typeof (value as OfficeSceneFurniture).placement === "string" &&
    Number.isFinite((value as OfficeSceneFurniture).col) &&
    Number.isFinite((value as OfficeSceneFurniture).row) &&
    Number.isFinite((value as OfficeSceneFurniture).width) &&
    Number.isFinite((value as OfficeSceneFurniture).height) &&
    Number.isFinite((value as OfficeSceneFurniture).color) &&
    Number.isFinite((value as OfficeSceneFurniture).accentColor)
  );
}

function isCharacterRecord(value: unknown): value is OfficeSceneCharacter {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as OfficeSceneCharacter).id === "string" &&
    typeof (value as OfficeSceneCharacter).label === "string" &&
    typeof (value as OfficeSceneCharacter).glyph === "string" &&
    Number.isFinite((value as OfficeSceneCharacter).col) &&
    Number.isFinite((value as OfficeSceneCharacter).row) &&
    Number.isFinite((value as OfficeSceneCharacter).color) &&
    Number.isFinite((value as OfficeSceneCharacter).accentColor)
  );
}

export function getOfficeSceneBootstrap(value: unknown): OfficeSceneBootstrap | null {
  if (typeof value !== "object" || value === null || !("layout" in value)) {
    return null;
  }

  const layout = value.layout;
  if (typeof layout !== "object" || layout === null) {
    return null;
  }

  const candidate = layout as Partial<OfficeSceneLayout>;
  if (
    !Number.isFinite(candidate.cols) ||
    !Number.isFinite(candidate.rows) ||
    !Number.isFinite(candidate.cellSize) ||
    !Array.isArray(candidate.tiles) ||
    !Array.isArray(candidate.furniture) ||
    !Array.isArray(candidate.characters)
  ) {
    return null;
  }

  if (
    !candidate.tiles.every(isTileRecord) ||
    !candidate.furniture.every(isFurnitureRecord) ||
    !candidate.characters.every(isCharacterRecord)
  ) {
    return null;
  }

  const cols = candidate.cols as number;
  const rows = candidate.rows as number;
  const cellSize = candidate.cellSize as number;
  const tiles = candidate.tiles;
  const furniture = candidate.furniture;
  const characters = candidate.characters;

  return {
    layout: {
      cols,
      rows,
      cellSize,
      tiles: tiles.map((tile, index) =>
        normalizeOfficeSceneTile(tile, index, {
          version: 1,
          cols,
          rows,
          tiles,
          furniture: [],
        }),
      ),
      furniture: furniture.map((item) => ({ ...item })),
      characters: characters.map((item) => ({ ...item })),
    },
  };
}

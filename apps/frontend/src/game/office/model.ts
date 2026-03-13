export const OFFICE_LAYOUT_VERSION = 1 as const;

export const OFFICE_TILE_TYPE = {
  WALL: 0,
  FLOOR_1: 1,
  FLOOR_2: 2,
  FLOOR_3: 3,
  FLOOR_4: 4,
  FLOOR_5: 5,
  FLOOR_6: 6,
  FLOOR_7: 7,
  VOID: 8,
} as const;

export type OfficeTileType = (typeof OFFICE_TILE_TYPE)[keyof typeof OFFICE_TILE_TYPE];

export type OfficeColorAdjustment = {
  h: number;
  s: number;
  b: number;
  c: number;
  colorize?: boolean;
};

export const DEFAULT_OFFICE_FLOOR_COLOR: OfficeColorAdjustment = {
  h: 0,
  s: 0,
  b: 0,
  c: 0,
};

export type OfficeFurnitureAsset = {
  id: string;
  name: string;
  label: string;
  category: string;
  file: string;
  width: number;
  height: number;
  footprintW: number;
  footprintH: number;
  isDesk: boolean;
  canPlaceOnWalls?: boolean;
  canPlaceOnSurfaces?: boolean;
  backgroundTiles?: number;
  groupId?: string;
  orientation?: "front" | "right" | "back" | "left" | (string & {});
  state?: "on" | "off" | (string & {});
};

export type OfficeFurnitureCatalogEntry = {
  type: string;
  label: string;
  category: string;
  footprintW: number;
  footprintH: number;
  isDesk: boolean;
  canPlaceOnWalls: boolean;
  canPlaceOnSurfaces: boolean;
  backgroundTiles: number;
  groupId?: string;
  orientation?: string;
  state?: string;
};

export type OfficeCatalog = {
  byType: ReadonlyMap<string, OfficeFurnitureCatalogEntry>;
  visibleTypesByCategory: ReadonlyMap<string, readonly string[]>;
  visibleCategories: readonly string[];
  rotationOrderByType: ReadonlyMap<string, readonly string[]>;
  statePartnerByType: ReadonlyMap<string, string>;
};

export type OfficePlacedFurniture = {
  uid: string;
  type: string;
  col: number;
  row: number;
  color?: OfficeColorAdjustment;
  zLayer?: number;
};

export type OfficeCharacterPose = "idle" | "walk" | "read" | "type";
export type OfficeCharacterDirection = "up" | "down" | "left" | "right";

export type OfficePlacedCharacter = {
  uid: string;
  characterType: "office-worker" | (string & {});
  paletteVariant: string;
  pose: OfficeCharacterPose;
  direction: OfficeCharacterDirection;
  col: number;
  row: number;
};

export type OfficeLayoutDocument = {
  version: typeof OFFICE_LAYOUT_VERSION;
  cols: number;
  rows: number;
  tiles: OfficeTileType[];
  furniture: OfficePlacedFurniture[];
  tileColors?: Array<OfficeColorAdjustment | null>;
  characters?: OfficePlacedCharacter[];
};

export type OfficeFurnitureInstance = OfficePlacedFurniture & {
  entry: OfficeFurnitureCatalogEntry;
};

export type ExpandDirection = "left" | "right" | "up" | "down";

export function getOfficeCharacters(
  layout: OfficeLayoutDocument,
): readonly OfficePlacedCharacter[] {
  return layout.characters ?? [];
}

export function getOfficeTileIndex(
  layout: Pick<OfficeLayoutDocument, "cols" | "tiles">,
  col: number,
  row: number,
): number {
  return row * layout.cols + col;
}

export function isOfficeTileInBounds(
  layout: Pick<OfficeLayoutDocument, "cols" | "rows">,
  col: number,
  row: number,
): boolean {
  return col >= 0 && col < layout.cols && row >= 0 && row < layout.rows;
}


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
export type OfficeTileIndex = number;
export type OfficeCharacterPose = "idle" | "walk" | "read" | "type";
export type OfficeCharacterDirection = "up" | "down" | "left" | "right";
export type OfficeFurnitureOrientation = "front" | "right" | "back" | "left";

export type OfficeCellCoord = {
  col: number;
  row: number;
};

export type OfficeFloorColor = {
  h: number;
  s: number;
  b: number;
  c: number;
  colorize?: boolean;
};

export type OfficePlacedFurniture = {
  uid: string;
  type: string;
  col: number;
  row: number;
  color?: OfficeFloorColor;
  zLayer?: number;
};

export type OfficePlacedCharacter = {
  uid: string;
  characterType: string;
  paletteVariant: string;
  pose: OfficeCharacterPose;
  direction: OfficeCharacterDirection;
  col: number;
  row: number;
};

export type OfficeLayoutDocument = {
  version: 1;
  cols: number;
  rows: number;
  tiles: OfficeTileType[];
  tileColors?: Array<OfficeFloorColor | null>;
  furniture: OfficePlacedFurniture[];
  characters?: OfficePlacedCharacter[];
};

export type OfficeFurnitureCatalogEntry = {
  id: string;
  label: string;
  category: string;
  footprintW: number;
  footprintH: number;
  isDesk: boolean;
  canPlaceOnWalls?: boolean;
  canPlaceOnSurfaces?: boolean;
  backgroundTiles?: number;
  groupId?: string;
  orientation?: OfficeFurnitureOrientation;
  state?: string;
};

export type OfficeCatalogIndex = {
  byId: ReadonlyMap<string, OfficeFurnitureCatalogEntry>;
  rotationOrderById: ReadonlyMap<string, readonly string[]>;
  stateSwapById: ReadonlyMap<string, string>;
};

export type OfficeExpandDirection = "left" | "right" | "up" | "down";

export type OfficeExpandResult = {
  layout: OfficeLayoutDocument;
  shift: OfficeCellCoord;
};

export function getOfficeTileIndex(
  layout: Pick<OfficeLayoutDocument, "cols" | "rows">,
  col: number,
  row: number,
): OfficeTileIndex | null {
  if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) {
    return null;
  }

  return row * layout.cols + col;
}

export function isOfficeTileWalkable(tile: OfficeTileType): boolean {
  return tile !== OFFICE_TILE_TYPE.WALL && tile !== OFFICE_TILE_TYPE.VOID;
}

export function getOfficeCharacters(
  layout: Pick<OfficeLayoutDocument, "characters">,
): OfficePlacedCharacter[] {
  return layout.characters ? [...layout.characters] : [];
}

export function cloneOfficeFloorColor(color: OfficeFloorColor): OfficeFloorColor {
  return { ...color };
}

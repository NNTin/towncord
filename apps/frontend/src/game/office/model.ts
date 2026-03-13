export const OfficeTileType = {
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

export type OfficeTileType = (typeof OfficeTileType)[keyof typeof OfficeTileType];
export type OfficeDirection = "up" | "down" | "left" | "right";
export type OfficeCharacterPose = "idle" | "walk" | "read" | "type";

export type FloorColor = {
  h: number;
  s: number;
  b: number;
  c: number;
  colorize?: boolean;
};

export type PlacedFurniture = {
  uid: string;
  type: string;
  col: number;
  row: number;
  color?: FloorColor;
  zLayer?: number;
};

export type PlacedOfficeCharacter = {
  uid: string;
  characterType: string;
  palette: string;
  pose: OfficeCharacterPose;
  direction: OfficeDirection;
  col: number;
  row: number;
};

export type OfficeLayoutDocument = {
  version: 1;
  cols: number;
  rows: number;
  tiles: OfficeTileType[];
  tileColors?: Array<FloorColor | null>;
  furniture: PlacedFurniture[];
  characters?: PlacedOfficeCharacter[];
};

export type OfficeFurnitureCatalogAsset = {
  id: string;
  label: string;
  category: string;
  file: string;
  width: number;
  height: number;
  footprintW: number;
  footprintH: number;
  isDesk: boolean;
  groupId?: string;
  orientation?: string;
  state?: string;
  canPlaceOnSurfaces?: boolean;
  backgroundTiles?: number;
  canPlaceOnWalls?: boolean;
};

export type OfficeFurnitureCatalogEntry = {
  type: string;
  label: string;
  category: string;
  footprintW: number;
  footprintH: number;
  isDesk: boolean;
  orientation?: string;
  state?: string;
  canPlaceOnSurfaces?: boolean;
  backgroundTiles?: number;
  canPlaceOnWalls?: boolean;
};

export type OfficeCatalogCategory = string;

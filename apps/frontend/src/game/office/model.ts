export const OFFICE_LAYOUT_DOCUMENT_VERSION = 1 as const;

export const OFFICE_TILE_COLORS = [
  "neutral",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
] as const;

export const OFFICE_DIRECTIONS = ["north", "east", "south", "west"] as const;
export const OFFICE_ROTATIONS = [0, 90, 180, 270] as const;

export type OfficeTileColor = (typeof OFFICE_TILE_COLORS)[number];
export type OfficeDirection = (typeof OFFICE_DIRECTIONS)[number];
export type OfficeRotation = (typeof OFFICE_ROTATIONS)[number];
export type OfficeFurnitureId = string;
export type OfficeCharacterId = string;
export type OfficeFurnitureKind = string;
export type OfficeCharacterKind = string;

export type OfficePoint = {
  x: number;
  y: number;
};

export type OfficeGridPosition = OfficePoint;

export type OfficeTileKey = `${number},${number}`;

export type OfficeRelativeTile = OfficePoint;

export type OfficeTile = {
  position: OfficeGridPosition;
  color: OfficeTileColor;
};

export type OfficeFloorFootprint = {
  width: number;
  height: number;
  blockedTiles?: readonly OfficeRelativeTile[];
};

export type OfficeSurfaceFootprint = {
  width: number;
  height: number;
};

type OfficeWallMount = {
  span: number;
};

export type OfficeFurnitureSurface = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OfficeFurnitureGeometry = {
  floor?: OfficeFloorFootprint;
  wall?: OfficeWallMount;
  surface?: OfficeSurfaceFootprint;
  surfaces?: readonly OfficeFurnitureSurface[];
};

export type OfficeFurnitureAnchor =
  | {
      kind: "floor";
      position: OfficeGridPosition;
    }
  | {
      kind: "wall";
      position: OfficeGridPosition;
      wall: OfficeDirection;
      offset: number;
    }
  | {
      kind: "surface";
      parentFurnitureId: OfficeFurnitureId;
      surfaceId: string;
      x: number;
      y: number;
    };

export type OfficeFurnitureCollision = {
  blocksMovement: boolean;
  blocksPlacement: boolean;
};

export type OfficeFurnitureInstance = {
  id: OfficeFurnitureId;
  kind: OfficeFurnitureKind;
  label: string;
  rotation: OfficeRotation;
  anchor: OfficeFurnitureAnchor;
  geometry: OfficeFurnitureGeometry;
  collision: OfficeFurnitureCollision;
  toggles: Readonly<Record<string, boolean>>;
  metadata?: Readonly<Record<string, string | number | boolean>>;
};

export type OfficeCharacterCollision = {
  blocksMovement: boolean;
  blocksPlacement: boolean;
};

export type OfficePlacedCharacter = {
  id: OfficeCharacterId;
  kind: OfficeCharacterKind;
  label: string;
  position: OfficeGridPosition;
  facing: OfficeDirection;
  collision: OfficeCharacterCollision;
  state: Readonly<Record<string, boolean>>;
  metadata?: Readonly<Record<string, string | number | boolean>>;
};

export type OfficeGrid = {
  columns: number;
  rows: number;
  defaultTileColor: OfficeTileColor;
  tiles: Record<OfficeTileKey, OfficeTile>;
};

export type OfficeLayoutDocument = {
  version: typeof OFFICE_LAYOUT_DOCUMENT_VERSION;
  grid: OfficeGrid;
  furniture: Record<OfficeFurnitureId, OfficeFurnitureInstance>;
  characters: Record<OfficeCharacterId, OfficePlacedCharacter>;
};

export type OfficeGridExpansion = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  fillColor?: OfficeTileColor;
};

export type OfficeLayoutAction =
  | {
      type: "paintTile";
      position: OfficeGridPosition;
      color: OfficeTileColor;
    }
  | {
      type: "eraseTile";
      position: OfficeGridPosition;
    }
  | {
      type: "placeFurniture";
      furniture: OfficeFurnitureInstance;
    }
  | {
      type: "moveFurniture";
      furnitureId: OfficeFurnitureId;
      anchor: OfficeFurnitureAnchor;
    }
  | {
      type: "rotateFurniture";
      furnitureId: OfficeFurnitureId;
      direction?: "clockwise" | "counterclockwise";
    }
  | {
      type: "toggleFurnitureState";
      furnitureId: OfficeFurnitureId;
      stateId?: string;
    }
  | {
      type: "removeFurniture";
      furnitureId: OfficeFurnitureId;
    }
  | {
      type: "placeCharacter";
      character: OfficePlacedCharacter;
    }
  | {
      type: "moveCharacter";
      characterId: OfficeCharacterId;
      position: OfficeGridPosition;
    }
  | {
      type: "removeCharacter";
      characterId: OfficeCharacterId;
    }
  | {
      type: "expandGrid";
      expansion: OfficeGridExpansion;
    };

export type OfficeLayoutCreateInput = {
  columns: number;
  rows: number;
  defaultTileColor?: OfficeTileColor;
};

export type OfficeLayoutColorAdjust = {
  h: number;
  s: number;
  b: number;
  c: number;
  colorize?: boolean;
};

export type OfficeSceneTileKind = "void" | "floor" | "wall";

export type OfficeSceneTile = {
  kind: OfficeSceneTileKind;
  tileId: number;
  tint?: number;
  colorAdjust?: OfficeLayoutColorAdjust | null;
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

export type OfficeSceneBootstrap = {
  layout: OfficeSceneLayout;
};

import type {
  OfficeSceneFurnitureCategory,
  OfficeSceneFurniturePlacement,
  OfficeSceneLayout,
} from "./office-scene";
import type {
  FurnitureRotationQuarterTurns,
  OfficeColorAdjust,
  OfficeTileColor,
} from "./content";

export type OfficeEditorToolId =
  | "floor"
  | "wall"
  | "erase"
  | "furniture"
  | "prop";
export type OfficeFloorMode = "paint" | "pick";

export type OfficeSetEditorToolNonePayload = {
  tool: null;
};

export type OfficeSetEditorToolWallPayload = {
  tool: "wall";
  wallColor: OfficeColorAdjust | null;
};

export type OfficeSetEditorToolErasePayload = {
  tool: "erase";
};

export type OfficeSetEditorToolFurniturePayload = {
  tool: "furniture";
  furnitureId: string | null;
  rotationQuarterTurns: FurnitureRotationQuarterTurns;
};

export type OfficeSetEditorToolPropPayload = {
  tool: "prop";
  propId: string | null;
  rotationQuarterTurns: FurnitureRotationQuarterTurns;
};

export type OfficeSetEditorToolFloorPayload = {
  tool: "floor";
  floorMode: OfficeFloorMode;
  tileColor: OfficeTileColor | null;
  floorColor: OfficeColorAdjust | null;
  floorPattern: string | null;
};

export type OfficeSetEditorToolPayload =
  | OfficeSetEditorToolNonePayload
  | OfficeSetEditorToolWallPayload
  | OfficeSetEditorToolErasePayload
  | OfficeSetEditorToolFurniturePayload
  | OfficeSetEditorToolPropPayload
  | OfficeSetEditorToolFloorPayload;

export type OfficeFloorPickedPayload = {
  floorColor: OfficeColorAdjust | null;
  floorPattern: string | null;
};

export type OfficeLayoutChangedPayload = {
  layout: OfficeSceneLayout;
};

export type OfficeSelectedPlaceablePayload = {
  kind: "furniture";
  id: string;
  assetId: string;
  label: string;
  category: OfficeSceneFurnitureCategory;
  placement: OfficeSceneFurniturePlacement;
  canRotate: boolean;
};

export type OfficeSelectionChangedPayload = {
  selection: OfficeSelectedPlaceablePayload | null;
};

export type OfficeSelectionActionPayload = {
  action: "rotate" | "delete";
};

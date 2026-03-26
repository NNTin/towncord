import type { OfficeSceneLayout } from "./office-scene";
import type { OfficeColorAdjust, OfficeTileColor } from "./content";

export type OfficeEditorToolId = "floor" | "wall" | "erase" | "furniture";
export type OfficeFloorMode = "paint" | "pick";

export type OfficeSetEditorToolNonePayload = {
  tool: null;
};

export type OfficeSetEditorToolWallPayload = {
  tool: "wall";
};

export type OfficeSetEditorToolErasePayload = {
  tool: "erase";
};

export type OfficeSetEditorToolFurniturePayload = {
  tool: "furniture";
  furnitureId: string | null;
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
  | OfficeSetEditorToolFloorPayload;

export type OfficeFloorPickedPayload = {
  floorColor: OfficeColorAdjust | null;
  floorPattern: string | null;
};

export type OfficeLayoutChangedPayload = {
  layout: OfficeSceneLayout;
};

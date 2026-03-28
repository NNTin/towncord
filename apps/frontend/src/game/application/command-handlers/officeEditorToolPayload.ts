import type {
  OfficeEditorToolId,
  OfficeFloorMode,
  OfficeSetEditorToolPayload,
} from "../../contracts/office-editor";
import type {
  FurnitureRotationQuarterTurns,
  OfficeColorAdjust,
  OfficeTileColor,
} from "../../contracts/content";

export type OfficeEditorBridgeState = {
  activeTool: OfficeEditorToolId | null;
  activeFloorMode: OfficeFloorMode;
  activeTileColor: OfficeTileColor | null;
  activeFloorColor: OfficeColorAdjust;
  activeFloorPattern: string | null;
  activeWallColor: OfficeColorAdjust;
  activeFurnitureId: string | null;
  activeFurnitureRotationQuarterTurns: FurnitureRotationQuarterTurns;
};

export function buildOfficeEditorToolPayload(
  state: OfficeEditorBridgeState,
): OfficeSetEditorToolPayload {
  switch (state.activeTool) {
    case "floor":
      return {
        tool: "floor",
        floorMode: state.activeFloorMode,
        tileColor: state.activeTileColor,
        floorColor: state.activeFloorColor,
        floorPattern: state.activeFloorPattern,
      };
    case "wall":
      return {
        tool: "wall",
        wallColor: state.activeWallColor,
      };
    case "furniture":
      return {
        tool: "furniture",
        furnitureId: state.activeFurnitureId,
        rotationQuarterTurns: state.activeFurnitureRotationQuarterTurns,
      };
    case "erase":
      return { tool: state.activeTool };
    default:
      return { tool: null };
  }
}

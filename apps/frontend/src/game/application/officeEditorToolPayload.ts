import type {
  OfficeEditorToolId,
  OfficeFloorMode,
  OfficeSetEditorToolPayload,
} from "../protocol";
import type { OfficeColorAdjust } from "../office/colors";
import type { OfficeTileColor } from "../office/model";

export type OfficeEditorBridgeState = {
  activeTool: OfficeEditorToolId | null;
  activeFloorMode: OfficeFloorMode;
  activeTileColor: OfficeTileColor | null;
  activeFloorColor: OfficeColorAdjust;
  activeFloorPattern: string | null;
  activeFurnitureId: string | null;
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
    case "furniture":
      return {
        tool: "furniture",
        furnitureId: state.activeFurnitureId,
      };
    case "wall":
    case "erase":
      return { tool: state.activeTool };
    default:
      return { tool: null };
  }
}

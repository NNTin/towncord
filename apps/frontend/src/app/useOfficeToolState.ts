import { useReducer } from "react";
import type {
  OfficeFloorMode,
  OfficeFloorPickedPayload,
  OfficeEditorToolId,
} from "../game/protocol";
import type { OfficeTileColor } from "../game/office/model";
import type { OfficeColorAdjust } from "../game/office/colors";
import {
  createOfficeToolStateData,
  reduceOfficeToolState,
  type OfficeToolStateData,
} from "./officeToolState";

type OfficeToolState = OfficeToolStateData & {
  toggleLayoutMode: () => void;
  activeTool: OfficeEditorToolId | null;
  onSelectTool: (tool: OfficeEditorToolId | null) => void;
  activeFloorMode: OfficeFloorMode;
  onSelectFloorMode: (mode: OfficeFloorMode) => void;
  activeTileColor: OfficeTileColor | null;
  onSelectTileColor: (color: OfficeTileColor) => void;
  activeFloorColor: OfficeColorAdjust;
  onSelectFloorColor: (color: OfficeColorAdjust) => void;
  activeFloorPattern: string | null;
  onSelectFloorPattern: (id: string) => void;
  activeFurnitureId: string | null;
  onSelectFurnitureId: (id: string) => void;
  onOfficeFloorPicked: (payload: OfficeFloorPickedPayload) => void;
};

export function useOfficeToolState(): OfficeToolState {
  const [state, dispatch] = useReducer(
    reduceOfficeToolState,
    undefined,
    createOfficeToolStateData,
  );

  return {
    ...state,
    activeTool: state.activeTool,
    toggleLayoutMode() {
      dispatch({ type: "toggleLayoutMode" });
    },
    onSelectTool(tool) {
      dispatch({ type: "selectTool", tool: tool as OfficeEditorToolId | null });
    },
    onSelectFloorMode(mode) {
      dispatch({ type: "selectFloorMode", mode });
    },
    onSelectTileColor(color) {
      dispatch({ type: "selectTileColor", color });
    },
    onSelectFloorColor(color) {
      dispatch({ type: "selectFloorColor", color });
    },
    onSelectFloorPattern(id) {
      dispatch({ type: "selectFloorPattern", id });
    },
    onSelectFurnitureId(id) {
      dispatch({ type: "selectFurnitureId", id });
    },
    onOfficeFloorPicked(payload) {
      dispatch({ type: "officeFloorPicked", payload });
    },
  };
}

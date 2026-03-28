import { useReducer } from "react";
import type {
  OfficeFloorMode,
  OfficeFloorPickedPayload,
  OfficeEditorToolId,
} from "../../../game/contracts/office-editor";
import type {
  FurnitureRotationQuarterTurns,
  OfficeColorAdjust,
  OfficeTileColor,
} from "../../../game/contracts/content";
import {
  createOfficeToolStateData,
  reduceOfficeToolState,
  type OfficeToolStateData,
} from "./officeToolState";

export type OfficeToolState = OfficeToolStateData & {
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
  activeWallColor: OfficeColorAdjust;
  onSelectWallColor: (color: OfficeColorAdjust) => void;
  activeFurnitureId: string | null;
  activeFurnitureRotationQuarterTurns: FurnitureRotationQuarterTurns;
  onSelectFurnitureId: (id: string) => void;
  onRotateFurnitureClockwise: () => void;
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
    onSelectWallColor(color) {
      dispatch({ type: "selectWallColor", color });
    },
    onSelectFurnitureId(id) {
      dispatch({ type: "selectFurnitureId", id });
    },
    onRotateFurnitureClockwise() {
      dispatch({ type: "rotateFurnitureClockwise" });
    },
    onOfficeFloorPicked(payload) {
      dispatch({ type: "officeFloorPicked", payload });
    },
  };
}

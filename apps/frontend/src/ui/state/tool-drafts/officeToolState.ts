import type {
  OfficeFloorMode,
  OfficeFloorPickedPayload,
  OfficeEditorToolId,
} from "../../../game/contracts/office-editor";
import {
  DEFAULT_FLOOR_COLOR_ADJUST,
  FLOOR_PATTERN_ITEMS,
  cloneOfficeColorAdjust,
  findOfficeTileColorPreset,
  resolveOfficeTileColorAdjustPreset,
  type FurnitureRotationQuarterTurns,
  type OfficeColorAdjust,
  type OfficeTileColor,
} from "../../../game/contracts/content";

export type OfficeToolStateData = {
  isLayoutPaintMode: boolean;
  activeTool: OfficeEditorToolId | null;
  activeFloorMode: OfficeFloorMode;
  activeTileColor: OfficeTileColor | null;
  activeFloorColor: OfficeColorAdjust;
  activeFloorPattern: string | null;
  activeFurnitureId: string | null;
  activeFurnitureRotationQuarterTurns: FurnitureRotationQuarterTurns;
};

export type OfficeToolStateAction =
  | { type: "toggleLayoutMode" }
  | { type: "selectTool"; tool: OfficeEditorToolId | null }
  | { type: "selectFloorMode"; mode: OfficeFloorMode }
  | { type: "selectTileColor"; color: OfficeTileColor }
  | { type: "selectFloorColor"; color: OfficeColorAdjust }
  | { type: "selectFloorPattern"; id: string }
  | { type: "selectFurnitureId"; id: string }
  | { type: "rotateFurnitureClockwise" }
  | { type: "officeFloorPicked"; payload: OfficeFloorPickedPayload };

const DEFAULT_FLOOR_PATTERN = FLOOR_PATTERN_ITEMS[0]?.id ?? null;

export function createOfficeToolStateData(): OfficeToolStateData {
  return {
    isLayoutPaintMode: false,
    activeTool: null,
    activeFloorMode: "paint",
    activeTileColor: null,
    activeFloorColor: cloneOfficeColorAdjust(DEFAULT_FLOOR_COLOR_ADJUST),
    activeFloorPattern: DEFAULT_FLOOR_PATTERN,
    activeFurnitureId: null,
    activeFurnitureRotationQuarterTurns: 0,
  };
}

function applyFloorColor(color: OfficeColorAdjust): Pick<
  OfficeToolStateData,
  "activeFloorColor" | "activeTileColor"
> {
  const cloned = cloneOfficeColorAdjust(color);
  return {
    activeFloorColor: cloned,
    activeTileColor: findOfficeTileColorPreset(cloned),
  };
}

function applyPresetFloorColor(color: OfficeTileColor): Pick<
  OfficeToolStateData,
  "activeFloorColor" | "activeTileColor"
> {
  return applyFloorColor(resolveOfficeTileColorAdjustPreset(color));
}

export function reduceOfficeToolState(
  state: OfficeToolStateData,
  action: OfficeToolStateAction,
): OfficeToolStateData {
  switch (action.type) {
    case "toggleLayoutMode":
      if (state.isLayoutPaintMode) {
        return {
          ...state,
          isLayoutPaintMode: false,
          activeTool: null,
          activeFloorMode: "paint",
        };
      }

      return {
        ...state,
        isLayoutPaintMode: true,
      };

    case "selectTool":
      if (!state.isLayoutPaintMode) {
        return {
          ...state,
          activeTool: null,
          activeFloorMode: "paint",
        };
      }

      if (action.tool === "floor") {
        return {
          ...state,
          activeTool: "floor",
        };
      }

      return {
        ...state,
        activeTool: action.tool,
        activeFloorMode: "paint",
      };

    case "selectFloorMode":
      return {
        ...state,
        activeTool: "floor",
        activeFloorMode: action.mode,
      };

    case "selectTileColor":
      return {
        ...state,
        ...applyPresetFloorColor(action.color),
      };

    case "selectFloorColor":
      return {
        ...state,
        ...applyFloorColor(action.color),
      };

    case "selectFloorPattern":
      return {
        ...state,
        activeFloorPattern: action.id,
      };

    case "selectFurnitureId":
      return {
        ...state,
        activeFurnitureId: action.id,
        activeFurnitureRotationQuarterTurns:
          state.activeFurnitureId === action.id
            ? state.activeFurnitureRotationQuarterTurns
            : 0,
      };

    case "rotateFurnitureClockwise":
      return {
        ...state,
        activeFurnitureRotationQuarterTurns:
          ((state.activeFurnitureRotationQuarterTurns + 1) %
            4) as FurnitureRotationQuarterTurns,
      };

    case "officeFloorPicked":
      return {
        ...state,
        activeTool: "floor",
        activeFloorMode: "paint",
        activeFloorPattern: action.payload.floorPattern,
        ...applyFloorColor(action.payload.floorColor ?? DEFAULT_FLOOR_COLOR_ADJUST),
      };
  }
}

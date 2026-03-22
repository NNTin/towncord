// Review: useOfficeToolState bundles two distinct concerns into a single hook:
//
//   1. Tool SELECTION — which tool is currently active (activeTool) and whether
//      the layout paint mode is enabled (isLayoutPaintMode).
//
//   2. Tool CONFIGURATION — the detailed settings for each tool: the floor color
//      (activeFloorColor), floor pattern (activeFloorPattern), tile color preset
//      (activeTileColor), floor sub-mode (activeFloorMode), and furniture ID
//      (activeFurnitureId).
//
// These two concerns change at different rates and for different reasons. Tool
// selection changes whenever the user clicks a toolbar button; tool configuration
// changes when the user picks a color, pattern, or furniture. Keeping them in one
// hook makes it impossible to subscribe to just one concern without re-rendering
// on the other, and makes the hook harder to test in isolation.
//
// Additionally, the hook imports from `game/scenes/office/colors` — a path inside
// the Phaser scene layer. React application hooks should not reach into the scene
// layer; they should import from `game/office/**` (the shared office domain) or
// from `game/events.ts` (the event contract). The dependency on
// `game/scenes/office/colors` leaks a scene implementation detail into the React
// application layer and violates the architectural rule that React ↔ Phaser
// communication must go through `game/events.ts` or `game/application/**`.
import { useEffect, useMemo, useState } from "react";
import type { OfficeLayoutTool } from "../components/BottomToolbar";
import type {
  OfficeFloorMode,
  OfficeFloorPickedPayload,
  OfficeSetEditorToolPayload,
} from "../game/events";
import type { OfficeTileColor } from "../game/office/model";
import { FLOOR_PATTERN_ITEMS } from "../game/office/officeTilePalette";
import {
  DEFAULT_FLOOR_COLOR_ADJUST,
  cloneOfficeColorAdjust,
  findOfficeTileColorPreset,
  resolveOfficeTileColorAdjustPreset,
  type OfficeColorAdjust,
} from "../game/scenes/office/colors"; // Review: this import crosses a layer boundary — see module-level comment above.

const DEFAULT_FLOOR_PATTERN = FLOOR_PATTERN_ITEMS[0]?.id ?? null;

type OfficeToolState = {
  isLayoutPaintMode: boolean;
  toggleLayoutMode: () => void;
  activeTool: OfficeLayoutTool | null;
  onSelectTool: (tool: OfficeLayoutTool | null) => void;
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
  editorToolPayload: OfficeSetEditorToolPayload;
};

export function useOfficeToolState(): OfficeToolState {
  const [isLayoutPaintMode, setIsLayoutPaintMode] = useState(false);
  const [activeTool, setActiveTool] = useState<OfficeLayoutTool | null>(null);
  const [activeFloorMode, setActiveFloorMode] = useState<OfficeFloorMode>("paint");
  const [activeTileColor, setActiveTileColor] = useState<OfficeTileColor | null>(null);
  const [activeFloorColor, setActiveFloorColor] = useState<OfficeColorAdjust>(
    () => ({ ...DEFAULT_FLOOR_COLOR_ADJUST }),
  );
  const [activeFloorPattern, setActiveFloorPattern] = useState<string | null>(DEFAULT_FLOOR_PATTERN);
  const [activeFurnitureId, setActiveFurnitureId] = useState<string | null>(null);

  function applyFloorColor(nextColor: OfficeColorAdjust): void {
    const cloned = cloneOfficeColorAdjust(nextColor);
    setActiveFloorColor(cloned);
    setActiveTileColor(findOfficeTileColorPreset(cloned));
  }

  // Review: These two useEffect calls implement hidden state-reset rules — "when paint
  // mode is turned off, clear the active tool" and "when the tool changes away from floor,
  // reset the floor sub-mode". These invariants are invisible to callers of the hook and
  // cannot be tested without rendering a component. They also run asynchronously (after
  // the current render), which means there is a brief window where isLayoutPaintMode is
  // false but activeTool is still non-null, or where activeTool is not "floor" but
  // activeFloorMode is still non-"paint". Encoding these rules as synchronous state
  // derivations (computed in the same handler that changes the source state) or as
  // useReducer transitions would make the invariants explicit, synchronous, and testable.
  useEffect(() => {
    if (!isLayoutPaintMode) {
      setActiveTool(null);
    }
  }, [isLayoutPaintMode]);

  useEffect(() => {
    if (activeTool !== "floor") {
      setActiveFloorMode("paint");
    }
  }, [activeTool]);

  // Review: editorToolPayload assembles an OfficeSetEditorToolPayload directly inside
  // this React hook. OfficeSetEditorToolPayload is a Phaser event contract type defined
  // in game/events.ts. By constructing the payload here, the React hook becomes aware of
  // the Phaser event schema, creating a semantic coupling: changes to the event payload
  // shape must be reflected here as well as in WorldScene.onSetOfficeEditorTool. Ideally
  // the hook should expose plain React state and let the bridge layer (useBloomseedUiBridge
  // or bloomseedUiBridgeHooks) be the only place that knows how to translate React state
  // into a Phaser event payload.
  const editorToolPayload = useMemo<OfficeSetEditorToolPayload>(
    () => {
      switch (activeTool) {
        case "floor":
          return {
            tool: "floor",
            floorMode: activeFloorMode,
            tileColor: activeTileColor,
            floorColor: activeFloorColor,
            floorPattern: activeFloorPattern,
          };
        case "furniture":
          return {
            tool: "furniture",
            furnitureId: activeFurnitureId,
          };
        case "wall":
        case "erase":
          return { tool: activeTool };
        default:
          return { tool: null };
      }
    },
    [activeTool, activeFloorMode, activeTileColor, activeFloorColor, activeFloorPattern, activeFurnitureId],
  );

  return {
    isLayoutPaintMode,
    toggleLayoutMode() {
      setIsLayoutPaintMode((current) => !current);
    },
    activeTool,
    onSelectTool(tool) {
      setActiveTool(tool);
    },
    activeFloorMode,
    onSelectFloorMode(mode) {
      setActiveFloorMode(mode);
      setActiveTool("floor");
    },
    activeTileColor,
    onSelectTileColor(color) {
      setActiveTileColor(color);
      applyFloorColor(resolveOfficeTileColorAdjustPreset(color));
    },
    activeFloorColor,
    onSelectFloorColor(color) {
      applyFloorColor(color);
    },
    activeFloorPattern,
    onSelectFloorPattern(id) {
      setActiveFloorPattern(id);
    },
    activeFurnitureId,
    onSelectFurnitureId(id) {
      setActiveFurnitureId(id);
    },
    onOfficeFloorPicked(payload) {
      setActiveTool("floor");
      setActiveFloorMode("paint");
      setActiveFloorPattern(payload.floorPattern);
      applyFloorColor(payload.floorColor ?? DEFAULT_FLOOR_COLOR_ADJUST);
    },
    editorToolPayload,
  };
}

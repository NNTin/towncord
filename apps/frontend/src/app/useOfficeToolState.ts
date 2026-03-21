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
} from "../game/scenes/office/colors";

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

  const editorToolPayload = useMemo<OfficeSetEditorToolPayload>(
    () => ({
      tool: activeTool,
      floorMode: activeTool === "floor" ? activeFloorMode : null,
      tileColor: activeTool === "floor" ? activeTileColor : null,
      floorColor: activeTool === "floor" ? activeFloorColor : null,
      floorPattern: activeTool === "floor" ? activeFloorPattern : null,
      furnitureId: activeFurnitureId,
    }),
    [
      activeTool,
      activeFloorMode,
      activeTileColor,
      activeFloorColor,
      activeFloorPattern,
      activeFurnitureId,
    ],
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

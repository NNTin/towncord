import { useEffect, useState } from "react";
import { OfficeEditorDrawer } from "./components/OfficeEditorDrawer";
import { BottomToolbar, type OfficeLayoutTool } from "./components/BottomToolbar";
import { SidebarAccordion } from "./components/SidebarAccordion";
import { ZoomControls } from "./components/ZoomControls";
import { useOfficeLayoutEditor } from "./app/useOfficeLayoutEditor";
import { useBloomseedUiBridge } from "./game/application/useBloomseedUiBridge";
import type { OfficeFloorMode } from "./game/events";
import type { OfficeTileColor } from "./game/office/model";
import { FLOOR_PATTERN_ITEMS } from "./game/office/officeTilePalette";
import {
  DEFAULT_FLOOR_COLOR_ADJUST,
  cloneOfficeColorAdjust,
  findOfficeTileColorPreset,
  resolveOfficeTileColorAdjustPreset,
  type OfficeColorAdjust,
} from "./game/scenes/office/colors";

const DEFAULT_FLOOR_PATTERN = FLOOR_PATTERN_ITEMS[0]?.id ?? null;

// Review: Custom Hook / Separation of Concerns — App holds 7 useState calls,
// 3 useEffects, and 3 handler functions that exclusively manage the office
// editor tool state (activeTool, floorMode, tileColor, floorColor, floorPattern,
// furnitureId, isLayoutPaintMode). This is a self-contained concern that should
// be extracted into a `useOfficeToolState()` custom hook, similar to how
// `useOfficeLayoutEditor()` already encapsulates the JSON editor lifecycle.
//
// The hook would own all tool-related state and expose a single
// `editorToolPayload` (for emitOfficeEditorTool) plus individual handlers
// (handleSelectTileColor, handleSelectFloorMode, etc.). App would then contain
// only the bridge wiring and JSX, reducing its complexity from ~165 LOC to ~80.
//
// This also improves testability: tool state transitions (e.g. "clearing
// activeTool when layout mode closes") can be unit-tested without rendering the
// full App tree.
function App(): JSX.Element {
  const officeEditor = useOfficeLayoutEditor();

  // isLayoutPaintMode controls the paint toolbar; the JSON drawer is a
  // separate toggle so they don't force each other open.
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

  const {
    gameRootRef,
    onGameRootDragOver,
    onGameRootDrop,
    sidebarProps,
    zoomProps,
    emitOfficeEditorTool,
  } = useBloomseedUiBridge({
    onOfficeLayoutChanged: officeEditor.syncFromPhaser,
    onOfficeFloorPicked: ({ floorColor, floorPattern }) => {
      setActiveTool("floor");
      setActiveFloorMode("paint");
      setActiveFloorPattern(floorPattern);
      applyFloorColor(floorColor ?? DEFAULT_FLOOR_COLOR_ADJUST);
    },
  });

  // Clear active tool when layout mode is closed so Phaser doesn't retain a
  // stale tool between layout mode sessions.
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

  // Sync tool state to the Phaser scene whenever it changes
  useEffect(() => {
    emitOfficeEditorTool({
      tool: activeTool,
      floorMode: activeTool === "floor" ? activeFloorMode : null,
      tileColor: activeTool === "floor" ? activeTileColor : null,
      floorColor: activeTool === "floor" ? activeFloorColor : null,
      floorPattern: activeTool === "floor" ? activeFloorPattern : null,
      furnitureId: activeFurnitureId,
    });
  }, [
    activeTool,
    activeFloorMode,
    activeTileColor,
    activeFloorColor,
    activeFloorPattern,
    activeFurnitureId,
    emitOfficeEditorTool,
  ]);

  function handleSelectTileColor(color: OfficeTileColor): void {
    setActiveTileColor(color);
    applyFloorColor(resolveOfficeTileColorAdjustPreset(color));
  }

  function handleSelectFloorColor(color: OfficeColorAdjust): void {
    applyFloorColor(color);
  }

  function handleSelectFloorMode(mode: OfficeFloorMode): void {
    setActiveFloorMode(mode);
    setActiveTool("floor");
  }

  return (
    <main className="app">
      {sidebarProps ? <SidebarAccordion {...sidebarProps} /> : null}
      {officeEditor.isOpen ? (
        <OfficeEditorDrawer
          canReload={officeEditor.isAvailable && !officeEditor.isLoading && !officeEditor.isSaving}
          canReset={officeEditor.canReset}
          canSave={officeEditor.canSave}
          error={officeEditor.error}
          parseError={officeEditor.parseError}
          isLoading={officeEditor.isLoading}
          isSaving={officeEditor.isSaving}
          jsonText={officeEditor.jsonText}
          onChangeJsonText={officeEditor.onChangeJsonText}
          onReload={() => void officeEditor.reload()}
          onReset={officeEditor.reset}
          onSave={() => void officeEditor.save()}
          parsedDocument={officeEditor.parsedDocument}
          sourcePath={officeEditor.sourcePath}
          statusText={officeEditor.statusText}
          updatedAt={officeEditor.updatedAt}
        />
      ) : null}
      {zoomProps ? <ZoomControls {...zoomProps} /> : null}
      <BottomToolbar
        isLayoutMode={isLayoutPaintMode}
        onToggleLayoutMode={() => setIsLayoutPaintMode((v) => !v)}
        isJsonEditorOpen={officeEditor.isOpen}
        onToggleJsonEditor={officeEditor.toggleOpen}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        activeFloorMode={activeFloorMode}
        onSelectFloorMode={handleSelectFloorMode}
        activeTileColor={activeTileColor}
        onSelectTileColor={handleSelectTileColor}
        activeFloorColor={activeFloorColor}
        onSelectFloorColor={handleSelectFloorColor}
        activeFloorPattern={activeFloorPattern}
        onSelectFloorPattern={setActiveFloorPattern}
        activeFurnitureId={activeFurnitureId}
        onSelectFurnitureId={setActiveFurnitureId}
        onResetLayout={officeEditor.reset}
        onSaveLayout={() => void officeEditor.save()}
        canResetLayout={officeEditor.canReset}
        canSaveLayout={officeEditor.canSave}
        isLayoutDirty={officeEditor.isDirty}
        isSavingLayout={officeEditor.isSaving}
        layoutStatusText={officeEditor.statusText}
      />
      <div
        ref={gameRootRef}
        className="game-root"
        onDragOver={onGameRootDragOver}
        onDrop={onGameRootDrop}
      />
    </main>
  );
}

export default App;

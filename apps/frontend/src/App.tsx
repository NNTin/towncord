import { useEffect, useState } from "react";
import { OfficeEditorDrawer } from "./components/OfficeEditorDrawer";
import { BottomToolbar, type OfficeLayoutTool } from "./components/BottomToolbar";
import { SidebarAccordion } from "./components/SidebarAccordion";
import { ZoomControls } from "./components/ZoomControls";
import { useOfficeLayoutEditor } from "./app/useOfficeLayoutEditor";
import { useBloomseedUiBridge } from "./game/application/useBloomseedUiBridge";

function App(): JSX.Element {
  const officeEditor = useOfficeLayoutEditor();
  const {
    gameRootRef,
    onGameRootDragOver,
    onGameRootDrop,
    sidebarProps,
    zoomProps,
    emitOfficeEditorTool,
  } = useBloomseedUiBridge({ onOfficeLayoutChanged: officeEditor.syncFromPhaser });

  // isLayoutPaintMode controls the paint toolbar; the JSON drawer is a
  // separate toggle so they don't force each other open.
  const [isLayoutPaintMode, setIsLayoutPaintMode] = useState(false);
  const [activeTool, setActiveTool] = useState<OfficeLayoutTool | null>(null);
  const [activeTileColor, setActiveTileColor] = useState<import("./game/office/model").OfficeTileColor | null>(null);
  const [activeFloorPattern, setActiveFloorPattern] = useState<string | null>(null);
  const [activeFurnitureId, setActiveFurnitureId] = useState<string | null>(null);

  // Clear active tool when layout mode is closed so Phaser doesn't retain a
  // stale tool between layout mode sessions.
  useEffect(() => {
    if (!isLayoutPaintMode) {
      setActiveTool(null);
    }
  }, [isLayoutPaintMode]);

  // Sync tool state to the Phaser scene whenever it changes
  useEffect(() => {
    emitOfficeEditorTool({
      tool: activeTool,
      tileColor: activeTileColor,
      floorPattern: activeFloorPattern,
      furnitureId: activeFurnitureId,
    });
  }, [activeTool, activeTileColor, activeFloorPattern, activeFurnitureId, emitOfficeEditorTool]);

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
        activeTileColor={activeTileColor}
        onSelectTileColor={setActiveTileColor}
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

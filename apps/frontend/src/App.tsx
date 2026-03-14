import { useEffect, useState } from "react";
import { OfficeEditorDrawer } from "./components/OfficeEditorDrawer";
import { BottomToolbar, type OfficeLayoutTool } from "./components/BottomToolbar";
import { SidebarAccordion } from "./components/SidebarAccordion";
import { ZoomControls } from "./components/ZoomControls";
import { useOfficeLayoutEditor } from "./app/useOfficeLayoutEditor";
import { useBloomseedUiBridge } from "./game/application/useBloomseedUiBridge";

function App(): JSX.Element {
  const {
    gameRootRef,
    onGameRootDragOver,
    onGameRootDrop,
    sidebarProps,
    zoomProps,
    emitOfficeEditorTool,
  } = useBloomseedUiBridge();
  const officeEditor = useOfficeLayoutEditor();
  const [activeTool, setActiveTool] = useState<OfficeLayoutTool | null>(null);
  const [activeTileColor, setActiveTileColor] = useState<import("./game/office/model").OfficeTileColor | null>(null);
  const [activeFurnitureId, setActiveFurnitureId] = useState<string | null>(null);

  // Clear active tool when layout mode is closed so Phaser doesn't retain a
  // stale tool between layout mode sessions.
  const isLayoutMode = officeEditor.isOpen;
  useEffect(() => {
    if (!isLayoutMode) {
      setActiveTool(null);
    }
  }, [isLayoutMode]);

  // Sync tool state to the Phaser scene whenever it changes
  useEffect(() => {
    emitOfficeEditorTool({
      tool: activeTool,
      tileColor: activeTileColor,
      furnitureId: activeFurnitureId,
    });
  }, [activeTool, activeTileColor, activeFurnitureId, emitOfficeEditorTool]);

  return (
    <main className="app">
      {sidebarProps ? <SidebarAccordion {...sidebarProps} /> : null}
      {isLayoutMode ? (
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
        isLayoutMode={isLayoutMode}
        onToggleLayoutMode={officeEditor.toggleOpen}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        activeTileColor={activeTileColor}
        onSelectTileColor={setActiveTileColor}
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

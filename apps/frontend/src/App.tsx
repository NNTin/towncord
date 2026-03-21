import { useEffect } from "react";
import { useOfficeToolState } from "./app/useOfficeToolState";
import { OfficeEditorDrawer } from "./components/OfficeEditorDrawer";
import { BottomToolbar } from "./components/BottomToolbar";
import { SidebarAccordion } from "./components/SidebarAccordion";
import { ZoomControls } from "./components/ZoomControls";
import { useOfficeLayoutEditor } from "./app/useOfficeLayoutEditor";
import { useBloomseedUiBridge } from "./game/application/useBloomseedUiBridge";
function App(): JSX.Element {
  const officeEditor = useOfficeLayoutEditor();
  const officeToolState = useOfficeToolState();

  const {
    gameRootRef,
    onGameRootDragOver,
    onGameRootDrop,
    sidebarProps,
    zoomProps,
    emitOfficeEditorTool,
  } = useBloomseedUiBridge({
    onOfficeLayoutChanged: officeEditor.syncFromPhaser,
    onOfficeFloorPicked: officeToolState.onOfficeFloorPicked,
  });

  useEffect(() => {
    emitOfficeEditorTool(officeToolState.editorToolPayload);
  }, [emitOfficeEditorTool, officeToolState.editorToolPayload]);

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
        isLayoutMode={officeToolState.isLayoutPaintMode}
        onToggleLayoutMode={officeToolState.toggleLayoutMode}
        isJsonEditorOpen={officeEditor.isOpen}
        onToggleJsonEditor={officeEditor.toggleOpen}
        activeTool={officeToolState.activeTool}
        onSelectTool={officeToolState.onSelectTool}
        activeFloorMode={officeToolState.activeFloorMode}
        onSelectFloorMode={officeToolState.onSelectFloorMode}
        activeTileColor={officeToolState.activeTileColor}
        onSelectTileColor={officeToolState.onSelectTileColor}
        activeFloorColor={officeToolState.activeFloorColor}
        onSelectFloorColor={officeToolState.onSelectFloorColor}
        activeFloorPattern={officeToolState.activeFloorPattern}
        onSelectFloorPattern={officeToolState.onSelectFloorPattern}
        activeFurnitureId={officeToolState.activeFurnitureId}
        onSelectFurnitureId={officeToolState.onSelectFurnitureId}
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

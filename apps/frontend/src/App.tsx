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
    runtimeRootRef,
    runtimeRootBindings,
    sidebarViewModel,
    zoomViewModel,
  } = useBloomseedUiBridge({
    officeToolState: {
      activeTool: officeToolState.activeTool,
      activeFloorMode: officeToolState.activeFloorMode,
      activeTileColor: officeToolState.activeTileColor,
      activeFloorColor: officeToolState.activeFloorColor,
      activeFloorPattern: officeToolState.activeFloorPattern,
      activeFurnitureId: officeToolState.activeFurnitureId,
    },
    onOfficeLayoutChanged: officeEditor.syncFromPhaser,
    onOfficeFloorPicked: officeToolState.onOfficeFloorPicked,
  });

  return (
    <main className="app">
      {sidebarViewModel ? <SidebarAccordion sidebar={sidebarViewModel} /> : null}
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
      {zoomViewModel ? <ZoomControls {...zoomViewModel} /> : null}
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
      <div ref={runtimeRootRef} className="game-root" {...runtimeRootBindings} />
    </main>
  );
}

export default App;

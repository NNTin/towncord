import { RuntimeHost } from "../game-session/host/RuntimeHost";
import { useGameSession } from "../game-session/hooks/useGameSession";
import { OfficeEditorDrawer } from "../editors/office-layout/OfficeEditorDrawer";
import { SidebarAccordion } from "../sidebar/shell/SidebarAccordion";
import { useOfficeToolState } from "../state/tool-drafts/useOfficeToolState";
import { BottomToolbar } from "../toolbar/bottom-toolbar/BottomToolbar";
import { ZoomControls } from "../toolbar/zoom-controls/ZoomControls";

function App(): JSX.Element {
  const officeToolState = useOfficeToolState();
  const {
    layoutSaveState,
    officeEditor,
    runtimeRootRef,
    runtimeRootBindings,
    sidebarViewModel,
    zoomViewModel,
  } = useGameSession({
    officeToolState,
  });

  return (
    <main className="app">
      {sidebarViewModel ? <SidebarAccordion sidebar={sidebarViewModel} /> : null}
      {officeEditor.isOpen ? (
        <OfficeEditorDrawer
          canReload={officeEditor.isAvailable && !officeEditor.isLoading && !layoutSaveState.isSaving}
          canReset={officeEditor.canReset}
          error={layoutSaveState.error}
          parseError={officeEditor.parseError}
          isLoading={officeEditor.isLoading}
          jsonText={officeEditor.jsonText}
          onChangeJsonText={officeEditor.onChangeJsonText}
          onReload={() => void officeEditor.reload()}
          onReset={layoutSaveState.reset}
          parsedDocument={officeEditor.parsedDocument}
          sourcePath={officeEditor.sourcePath}
          statusText={layoutSaveState.statusText}
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
        onResetLayout={layoutSaveState.reset}
        onSaveLayout={() => void layoutSaveState.save()}
        canResetLayout={layoutSaveState.canReset}
        canSaveLayout={layoutSaveState.canSave}
        isLayoutDirty={layoutSaveState.isDirty}
        isSavingLayout={layoutSaveState.isSaving}
        layoutStatusText={layoutSaveState.statusText}
      />
      <RuntimeHost
        runtimeRootRef={runtimeRootRef}
        runtimeRootBindings={runtimeRootBindings}
      />
    </main>
  );
}

export default App;

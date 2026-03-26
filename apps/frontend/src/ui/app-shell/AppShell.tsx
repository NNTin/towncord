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
      <RuntimeHost
        runtimeRootRef={runtimeRootRef}
        runtimeRootBindings={runtimeRootBindings}
      />
    </main>
  );
}

export default App;

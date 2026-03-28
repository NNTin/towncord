import { Suspense, lazy } from "react";
import { RuntimeHost } from "../game-session/host/RuntimeHost";
import { useGameSession } from "../game-session/hooks/useGameSession";
import { OfficeEditorDrawer } from "../editors/office-layout/OfficeEditorDrawer";
import { useOfficeToolState } from "../state/tool-drafts/useOfficeToolState";
import { BottomToolbar } from "../toolbar/bottom-toolbar/BottomToolbar";
import { ZoomControls } from "../toolbar/zoom-controls/ZoomControls";
import { useDebugUiEnabled } from "./debugMode";

const LazySidebarAccordion = lazy(async () => {
  const module = await import("../sidebar/shell/SidebarAccordion");
  return {
    default: module.SidebarAccordion,
  };
});

function App(): JSX.Element {
  const isDebugUiEnabled = useDebugUiEnabled();
  const officeToolState = useOfficeToolState();
  const {
    layoutSaveState,
    officeEditor,
    activeTerrainTool,
    entityToolbarViewModel,
    selectedOfficePlaceable,
    onRotateSelectedOfficePlaceable,
    onDeleteSelectedOfficePlaceable,
    onSelectTerrainTool,
    runtimeRootRef,
    runtimeRootBindings,
    sidebarViewModel,
    zoomViewModel,
  } = useGameSession({
    officeToolState,
  });

  return (
    <main className="app">
      {isDebugUiEnabled && sidebarViewModel ? (
        <Suspense fallback={null}>
          <LazySidebarAccordion sidebar={sidebarViewModel} />
        </Suspense>
      ) : null}
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
        activeWallColor={officeToolState.activeWallColor}
        onSelectWallColor={officeToolState.onSelectWallColor}
        activeFurnitureId={officeToolState.activeFurnitureId}
        activeFurnitureRotationQuarterTurns={
          officeToolState.activeFurnitureRotationQuarterTurns
        }
        onSelectFurnitureId={officeToolState.onSelectFurnitureId}
        onRotateFurnitureClockwise={officeToolState.onRotateFurnitureClockwise}
        activeTerrainTool={activeTerrainTool}
        entityToolbarViewModel={entityToolbarViewModel}
        selectedOfficePlaceable={selectedOfficePlaceable}
        onRotateSelectedOfficePlaceable={onRotateSelectedOfficePlaceable}
        onDeleteSelectedOfficePlaceable={onDeleteSelectedOfficePlaceable}
        onSelectTerrainTool={onSelectTerrainTool}
        onResetLayout={layoutSaveState.reset}
        onSaveLayout={() => void layoutSaveState.save()}
        canResetLayout={layoutSaveState.canReset}
        canSaveLayout={layoutSaveState.canSave}
        isLayoutDirty={layoutSaveState.isDirty}
        isTerrainDirty={layoutSaveState.isTerrainDirty}
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

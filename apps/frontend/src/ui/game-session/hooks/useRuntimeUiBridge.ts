import { useEffect, useMemo } from "react";
import type { MutableRefObject } from "react";
import type { OfficeFloorPickedPayload } from "../../../game/contracts/office-editor";
import type { OfficeSceneLayout } from "../../../game/contracts/office-scene";
import { buildOfficeEditorToolPayload } from "../../../game";
import type { OfficeEditorBridgeState } from "../../../game";
import type {
  RuntimeRootBindings,
  SidebarViewModel,
  ZoomControlsViewModel,
} from "../contracts";
import {
  useRuntimeGatewayLifecycle,
  useRuntimeInteractionAdapter,
  useRuntimeSyncAdapter,
} from "./runtimeUiBridgeHooks";
import { createPlaceablesSidebarBridge } from "../view-models/placeablesSidebarBridge";

type RuntimeUiBridge = {
  runtimeRootRef: MutableRefObject<HTMLDivElement | null>;
  runtimeRootBindings: RuntimeRootBindings;
  sidebarViewModel: SidebarViewModel | null;
  zoomViewModel: ZoomControlsViewModel | null;
};

export function useRuntimeUiBridge(options: {
  officeToolState: OfficeEditorBridgeState;
  onOfficeLayoutChanged?: (layout: OfficeSceneLayout) => void;
  onOfficeFloorPicked?: (payload: OfficeFloorPickedPayload) => void;
}): RuntimeUiBridge {
  const runtimeSync = useRuntimeSyncAdapter();
  const { runtimeRootRef, sessionRef } = useRuntimeGatewayLifecycle({
    onBootstrap: runtimeSync.onBootstrap,
    onTerrainTileInspected: runtimeSync.onTerrainTileInspected,
    onRuntimeDiagnostics: runtimeSync.onRuntimeDiagnostics,
    onZoomChanged: runtimeSync.onZoomChanged,
    onOfficeLayoutChanged: options.onOfficeLayoutChanged,
    onOfficeFloorPicked: options.onOfficeFloorPicked,
  });
  const { runtimeRootBindings, zoomViewModel } = useRuntimeInteractionAdapter({
    runtimeRootRef,
    sessionRef,
    zoomState: runtimeSync.zoomState,
  });

  useEffect(() => {
    sessionRef.current?.selectTerrainTool(runtimeSync.activeTerrainTool);
  }, [sessionRef, runtimeSync.activeTerrainTool]);

  useEffect(() => {
    sessionRef.current?.setOfficeEditorTool(
      buildOfficeEditorToolPayload(options.officeToolState),
    );
  }, [
    sessionRef,
    options.officeToolState.activeTool,
    options.officeToolState.activeFloorMode,
    options.officeToolState.activeTileColor,
    options.officeToolState.activeFloorColor,
    options.officeToolState.activeFloorPattern,
    options.officeToolState.activeFurnitureId,
  ]);

  const sidebarViewModel = useMemo<SidebarViewModel | null>(() => {
    const projection = runtimeSync.runtimeSidebarProjection;
    if (!projection) {
      return null;
    }

    return {
      placeablesPanel: createPlaceablesSidebarBridge({
        placeables: projection.placeables,
        activeTerrainTool: runtimeSync.activeTerrainTool,
        onSelectTerrainTool: runtimeSync.onSelectTerrainTool,
      }),
      previewPanel: {
        catalog: projection.catalog,
        inspectedTile: projection.inspectedTile,
        onClearInspectedTile: runtimeSync.onClearInspectedTile,
      },
      runtimeDiagnostics: projection.runtimeDiagnostics,
    };
  }, [
    runtimeSync.activeTerrainTool,
    runtimeSync.onClearInspectedTile,
    runtimeSync.onSelectTerrainTool,
    runtimeSync.runtimeSidebarProjection,
  ]);

  return {
    runtimeRootRef,
    runtimeRootBindings,
    sidebarViewModel,
    zoomViewModel,
  };
}

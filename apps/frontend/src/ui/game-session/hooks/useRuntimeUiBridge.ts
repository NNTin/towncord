import { useCallback, useEffect, useMemo, useState } from "react";
import type { MutableRefObject } from "react";
import type { OfficeFloorPickedPayload } from "../../../game/contracts/office-editor";
import type { OfficeSelectedPlaceablePayload } from "../../../game/contracts/office-editor";
import type { TerrainToolSelection } from "../../../game/contracts/runtime";
import type { OfficeSceneLayout } from "../../../game/contracts/office-scene";
import { buildOfficeEditorToolPayload } from "../../../game";
import type {
  OfficeEditorBridgeState,
  TerrainSeedDocument,
} from "../../../game";
import type {
  EntityToolbarViewModel,
  PropToolbarViewModel,
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
import { createToolbarPropPaletteBridge } from "../view-models/toolbarPropPaletteBridge";
import { createToolbarEntityPaletteBridge } from "../view-models/toolbarEntityPaletteBridge";

type RuntimeUiBridge = {
  runtimeRootRef: MutableRefObject<HTMLDivElement | null>;
  runtimeRootBindings: RuntimeRootBindings;
  sidebarViewModel: SidebarViewModel | null;
  entityToolbarViewModel: EntityToolbarViewModel | null;
  propToolbarViewModel: PropToolbarViewModel | null;
  selectedOfficePlaceable: OfficeSelectedPlaceablePayload | null;
  onRotateSelectedOfficePlaceable: () => void;
  onDeleteSelectedOfficePlaceable: () => void;
  zoomViewModel: ZoomControlsViewModel | null;
  terrainSeedSnapshot: TerrainSeedDocument | null;
  activeTerrainTool: TerrainToolSelection;
  onSelectTerrainTool: (tool: TerrainToolSelection) => void;
};

export function useRuntimeUiBridge(options: {
  officeToolState: OfficeEditorBridgeState;
  onOfficeLayoutChanged?: (layout: OfficeSceneLayout) => void;
  onTerrainSeedChanged?: (seed: TerrainSeedDocument) => void;
  onOfficeFloorPicked?: (payload: OfficeFloorPickedPayload) => void;
  onClearOfficeTool?: () => void;
}): RuntimeUiBridge {
  const runtimeSync = useRuntimeSyncAdapter();
  const [terrainSeedSnapshot, setTerrainSeedSnapshot] =
    useState<TerrainSeedDocument | null>(null);
  const { runtimeRootRef, sessionRef } = useRuntimeGatewayLifecycle({
    onBootstrap: runtimeSync.onBootstrap,
    onTerrainTileInspected: runtimeSync.onTerrainTileInspected,
    onRuntimeDiagnostics: runtimeSync.onRuntimeDiagnostics,
    onZoomChanged: runtimeSync.onZoomChanged,
    onOfficeSelectionChanged: runtimeSync.onOfficeSelectionChanged,
    onOfficeLayoutChanged: options.onOfficeLayoutChanged,
    onTerrainSeedChanged(seed) {
      setTerrainSeedSnapshot(seed);
      options.onTerrainSeedChanged?.(seed);
    },
    onOfficeFloorPicked: options.onOfficeFloorPicked,
  });
  const { runtimeRootBindings, zoomViewModel } = useRuntimeInteractionAdapter({
    runtimeRootRef,
    sessionRef,
    zoomState: runtimeSync.zoomState,
  });
  const selectedOfficePlaceable =
    runtimeSync.officeSelection?.selection ?? null;

  const onSelectTerrainTool = useCallback(
    (tool: TerrainToolSelection) => {
      if (tool) {
        options.onClearOfficeTool?.();
      }

      runtimeSync.onSelectTerrainTool(tool);
    },
    [options.onClearOfficeTool, runtimeSync.onSelectTerrainTool],
  );

  const onRotateSelectedOfficePlaceable = useCallback(() => {
    sessionRef.current?.rotateSelectedOfficePlaceable();
  }, [sessionRef]);

  const onDeleteSelectedOfficePlaceable = useCallback(() => {
    sessionRef.current?.deleteSelectedOfficePlaceable();
  }, [sessionRef]);

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
    options.officeToolState.activeWallColor,
    options.officeToolState.activeFurnitureId,
    options.officeToolState.activeFurnitureRotationQuarterTurns,
    options.officeToolState.activePropId,
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
        onSelectTerrainTool,
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
    runtimeSync.runtimeSidebarProjection,
    onSelectTerrainTool,
  ]);

  const entityToolbarViewModel = useMemo<EntityToolbarViewModel | null>(() => {
    const projection = runtimeSync.runtimeSidebarProjection;
    if (!projection) {
      return null;
    }

    return createToolbarEntityPaletteBridge({
      placeables: projection.placeables,
    });
  }, [runtimeSync.runtimeSidebarProjection]);

  const propToolbarViewModel = useMemo<PropToolbarViewModel | null>(() => {
    const projection = runtimeSync.runtimeSidebarProjection;
    if (!projection) {
      return null;
    }

    return createToolbarPropPaletteBridge({
      placeables: projection.placeables,
    });
  }, [runtimeSync.runtimeSidebarProjection]);

  return {
    runtimeRootRef,
    runtimeRootBindings,
    sidebarViewModel,
    entityToolbarViewModel,
    propToolbarViewModel,
    selectedOfficePlaceable,
    onRotateSelectedOfficePlaceable,
    onDeleteSelectedOfficePlaceable,
    zoomViewModel,
    terrainSeedSnapshot,
    activeTerrainTool: runtimeSync.activeTerrainTool,
    onSelectTerrainTool,
  };
}

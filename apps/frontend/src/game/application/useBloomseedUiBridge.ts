import { useEffect, useRef, useState } from "react";
import type { DragEvent, MutableRefObject } from "react";
import type { OfficeSceneLayout } from "../scenes/office/bootstrap";
import {
  UI_TO_RUNTIME_COMMANDS,
  emitUiToRuntimeCommand,
  type OfficeFloorPickedPayload,
  type RuntimePerfPayload,
  type ZoomChangedPayload,
} from "../protocol";
import type { AnimationCatalog } from "../assets/animationCatalog";
import type { PlaceableViewModel } from "./placeableService";
import {
  useBloomseedDragDrop,
  useBloomseedGameLifecycle,
  useBloomseedTerrainBridge,
  useBloomseedZoomControls,
  type BloomseedSidebarBridgeProps,
  type ZoomControlsProps,
} from "./bloomseedUiBridgeHooks";
import {
  buildOfficeEditorToolPayload,
  type OfficeEditorBridgeState,
} from "./officeEditorToolPayload";

type BloomseedUiBridge = {
  gameRootRef: MutableRefObject<HTMLDivElement | null>;
  onGameRootDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onGameRootDrop: (event: DragEvent<HTMLDivElement>) => void;
  sidebarProps: BloomseedSidebarBridgeProps | null;
  zoomProps: ZoomControlsProps | null;
};

export function useBloomseedUiBridge(options: {
  officeToolState: OfficeEditorBridgeState;
  onOfficeLayoutChanged?: (layout: OfficeSceneLayout) => void;
  onOfficeFloorPicked?: (payload: OfficeFloorPickedPayload) => void;
}): BloomseedUiBridge {
  const gameRootRef = useRef<HTMLDivElement | null>(null);
  const [catalog, setCatalog] = useState<AnimationCatalog | null>(null);
  const [placeables, setPlaceables] = useState<PlaceableViewModel[] | null>(null);
  const [runtimePerf, setRuntimePerf] = useState<RuntimePerfPayload | null>(null);
  const [zoomState, setZoomState] = useState<ZoomChangedPayload | null>(null);
  const terrainBridge = useBloomseedTerrainBridge({
    catalog,
    placeables,
    runtimePerf,
  });
  const gameRef = useBloomseedGameLifecycle({
    gameRootRef,
    onBootstrap: (payload) => {
      setCatalog(payload.catalog);
      setPlaceables(payload.placeables);
    },
    onTerrainTileInspected: terrainBridge.onTerrainTileInspected,
    onRuntimePerf: setRuntimePerf,
    onZoomChanged: setZoomState,
    onOfficeLayoutChanged: options.onOfficeLayoutChanged,
    onOfficeFloorPicked: options.onOfficeFloorPicked,
  });
  const dragDropHandlers = useBloomseedDragDrop({ gameRootRef, gameRef });
  const zoomProps = useBloomseedZoomControls({ gameRef, zoomState });

  useEffect(() => {
    emitUiToRuntimeCommand(
      gameRef.current,
      UI_TO_RUNTIME_COMMANDS.SELECT_TERRAIN_TOOL,
      terrainBridge.activeTerrainTool,
    );
  }, [gameRef, terrainBridge.activeTerrainTool]);

  useEffect(() => {
    emitUiToRuntimeCommand(
      gameRef.current,
      UI_TO_RUNTIME_COMMANDS.OFFICE_SET_EDITOR_TOOL,
      buildOfficeEditorToolPayload(options.officeToolState),
    );
  }, [
    gameRef,
    options.officeToolState.activeTool,
    options.officeToolState.activeFloorMode,
    options.officeToolState.activeTileColor,
    options.officeToolState.activeFloorColor,
    options.officeToolState.activeFloorPattern,
    options.officeToolState.activeFurnitureId,
  ]);

  return {
    gameRootRef,
    onGameRootDragOver: dragDropHandlers.onGameRootDragOver,
    onGameRootDrop: dragDropHandlers.onGameRootDrop,
    sidebarProps: terrainBridge.sidebarProps,
    zoomProps,
  };
}

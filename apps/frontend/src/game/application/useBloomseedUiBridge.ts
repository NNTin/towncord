import { useEffect, useRef, useState } from "react";
import type { DragEvent, MutableRefObject } from "react";
import type { OfficeSceneLayout } from "../scenes/office/bootstrap";
import {
  OFFICE_SET_EDITOR_TOOL_EVENT,
  SELECT_TERRAIN_TOOL_EVENT,
  type OfficeFloorPickedPayload,
  type OfficeSetEditorToolPayload,
  type RuntimePerfPayload,
  type ZoomChangedPayload,
} from "../events";
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

type BloomseedUiBridge = {
  gameRootRef: MutableRefObject<HTMLDivElement | null>;
  onGameRootDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onGameRootDrop: (event: DragEvent<HTMLDivElement>) => void;
  sidebarProps: BloomseedSidebarBridgeProps | null;
  zoomProps: ZoomControlsProps | null;
  emitOfficeEditorTool: (payload: OfficeSetEditorToolPayload) => void;
};

export function useBloomseedUiBridge(options?: {
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
    onOfficeLayoutChanged: options?.onOfficeLayoutChanged,
    onOfficeFloorPicked: options?.onOfficeFloorPicked,
  });
  const dragDropHandlers = useBloomseedDragDrop({ gameRootRef, gameRef });
  const zoomProps = useBloomseedZoomControls({ gameRef, zoomState });

  useEffect(() => {
    gameRef.current?.events.emit(SELECT_TERRAIN_TOOL_EVENT, terrainBridge.activeTerrainTool);
  }, [gameRef, terrainBridge.activeTerrainTool]);

  return {
    gameRootRef,
    onGameRootDragOver: dragDropHandlers.onGameRootDragOver,
    onGameRootDrop: dragDropHandlers.onGameRootDrop,
    emitOfficeEditorTool(payload) {
      gameRef.current?.events.emit(OFFICE_SET_EDITOR_TOOL_EVENT, payload);
    },
    sidebarProps: terrainBridge.sidebarProps,
    zoomProps,
  };
}

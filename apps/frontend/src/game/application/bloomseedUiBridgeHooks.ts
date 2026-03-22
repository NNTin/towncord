import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent, MutableRefObject } from "react";
import type Phaser from "phaser";
import type { AnimationCatalog } from "../assets/animationCatalog";
import {
  type BloomseedUiBootstrap,
  PLACE_DRAG_MIME,
  RUNTIME_TO_UI_EVENTS,
  UI_TO_RUNTIME_COMMANDS,
  bindRuntimeToUiEvent,
  emitPlaceDropCommand,
  emitUiToRuntimeCommand,
  type OfficeFloorPickedPayload,
  type OfficeLayoutChangedPayload,
  type PlaceObjectDropPayload,
  type PlaceTerrainDropPayload,
  type RuntimePerfPayload,
  type SelectedTerrainToolPayload,
  type TerrainTileInspectedPayload,
  type ZoomChangedPayload,
  parsePlaceDragMimePayload,
  toPlaceDropPayload,
} from "../protocol";
import type { OfficeSceneLayout } from "../scenes/office/bootstrap";
import { createGame } from "../phaser/createGame";
import type { PlaceableViewModel } from "./placeableService";

export type BloomseedSidebarBridgeProps = {
  catalog: AnimationCatalog;
  placeables: PlaceableViewModel[];
  inspectedTile: TerrainTileInspectedPayload | null;
  onClearInspectedTile: () => void;
  activeTerrainTool: SelectedTerrainToolPayload;
  onSelectTerrainTool: (tool: SelectedTerrainToolPayload) => void;
  runtimePerf: RuntimePerfPayload | null;
};

export type ZoomControlsProps = {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

type BloomseedGameLifecycleOptions = {
  gameRootRef: MutableRefObject<HTMLDivElement | null>;
  onBootstrap: (payload: BloomseedUiBootstrap) => void;
  onTerrainTileInspected: (payload: TerrainTileInspectedPayload) => void;
  onRuntimePerf: (payload: RuntimePerfPayload) => void;
  onZoomChanged: (payload: ZoomChangedPayload) => void;
  onOfficeLayoutChanged?: ((layout: OfficeSceneLayout) => void) | undefined;
  onOfficeFloorPicked?: ((payload: OfficeFloorPickedPayload) => void) | undefined;
};

type BloomseedDragDropOptions = {
  gameRootRef: MutableRefObject<HTMLDivElement | null>;
  gameRef: MutableRefObject<Phaser.Game | null>;
};

type BloomseedZoomOptions = {
  gameRef: MutableRefObject<Phaser.Game | null>;
  zoomState: ZoomChangedPayload | null;
};

type BloomseedTerrainBridgeOptions = {
  catalog: AnimationCatalog | null;
  placeables: PlaceableViewModel[] | null;
  runtimePerf: RuntimePerfPayload | null;
};

type BloomseedTerrainBridge = {
  sidebarProps: BloomseedSidebarBridgeProps | null;
  activeTerrainTool: SelectedTerrainToolPayload;
  onTerrainTileInspected: (payload: TerrainTileInspectedPayload) => void;
};

function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export function useBloomseedGameLifecycle({
  gameRootRef,
  onBootstrap,
  onTerrainTileInspected,
  onRuntimePerf,
  onZoomChanged,
  onOfficeLayoutChanged,
  onOfficeFloorPicked,
}: BloomseedGameLifecycleOptions): MutableRefObject<Phaser.Game | null> {
  const gameRef = useRef<Phaser.Game | null>(null);
  const onBootstrapRef = useLatestRef(onBootstrap);
  const onTerrainTileInspectedRef = useLatestRef(onTerrainTileInspected);
  const onRuntimePerfRef = useLatestRef(onRuntimePerf);
  const onZoomChangedRef = useLatestRef(onZoomChanged);
  const onOfficeLayoutChangedRef = useLatestRef(onOfficeLayoutChanged);
  const onOfficeFloorPickedRef = useLatestRef(onOfficeFloorPicked);

  useEffect(() => {
    const container = gameRootRef.current;
    if (!container) return;

    const game = createGame(container);
    gameRef.current = game;

    function handleBootstrap(payload: BloomseedUiBootstrap): void {
      onBootstrapRef.current(payload);
    }

    function handleTerrainTileInspected(payload: TerrainTileInspectedPayload): void {
      onTerrainTileInspectedRef.current(payload);
    }

    function handleRuntimePerf(payload: RuntimePerfPayload): void {
      onRuntimePerfRef.current(payload);
    }

    function handleZoomChanged(payload: ZoomChangedPayload): void {
      onZoomChangedRef.current(payload);
    }

    function handleOfficeLayoutChanged(payload: OfficeLayoutChangedPayload): void {
      onOfficeLayoutChangedRef.current?.(payload.layout);
    }

    function handleOfficeFloorPicked(payload: OfficeFloorPickedPayload): void {
      onOfficeFloorPickedRef.current?.(payload);
    }

    let unbindBootstrap = () => {};
    unbindBootstrap = bindRuntimeToUiEvent(
      game,
      RUNTIME_TO_UI_EVENTS.BLOOMSEED_READY,
      (payload) => {
        handleBootstrap(payload);
        unbindBootstrap();
      },
    );
    const unbindTerrainTileInspected = bindRuntimeToUiEvent(
      game,
      RUNTIME_TO_UI_EVENTS.TERRAIN_TILE_INSPECTED,
      handleTerrainTileInspected,
    );
    const unbindRuntimePerf = bindRuntimeToUiEvent(
      game,
      RUNTIME_TO_UI_EVENTS.RUNTIME_PERF,
      handleRuntimePerf,
    );
    const unbindZoomChanged = bindRuntimeToUiEvent(
      game,
      RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED,
      handleZoomChanged,
    );
    const unbindOfficeLayoutChanged = bindRuntimeToUiEvent(
      game,
      RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED,
      handleOfficeLayoutChanged,
    );
    const unbindOfficeFloorPicked = bindRuntimeToUiEvent(
      game,
      RUNTIME_TO_UI_EVENTS.OFFICE_FLOOR_PICKED,
      handleOfficeFloorPicked,
    );

    return () => {
      unbindBootstrap();
      unbindTerrainTileInspected();
      unbindRuntimePerf();
      unbindZoomChanged();
      unbindOfficeLayoutChanged();
      unbindOfficeFloorPicked();
      game.destroy(true);
      if (gameRef.current === game) {
        gameRef.current = null;
      }
    };
  }, [gameRootRef]);

  return gameRef;
}

export function useBloomseedDragDrop({
  gameRootRef,
  gameRef,
}: BloomseedDragDropOptions): {
  onGameRootDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onGameRootDrop: (event: DragEvent<HTMLDivElement>) => void;
} {
  const onGameRootDragOver = useCallback((event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onGameRootDrop = useCallback((event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();

    const rawPayload = event.dataTransfer.getData(PLACE_DRAG_MIME);
    if (!rawPayload) return;

    const dragPayload = parsePlaceDragMimePayload(rawPayload);
    if (!dragPayload) return;

    const rect = gameRootRef.current?.getBoundingClientRect();
    if (!rect) return;

    emitPlaceDropCommand(
      gameRef.current,
      toPlaceDropPayload(
        dragPayload,
        event.clientX - rect.left,
        event.clientY - rect.top,
      ),
    );
  }, [gameRef, gameRootRef]);

  return {
    onGameRootDragOver,
    onGameRootDrop,
  };
}

export function useBloomseedZoomControls({
  gameRef,
  zoomState,
}: BloomseedZoomOptions): ZoomControlsProps | null {
  const onZoomIn = useCallback(() => {
    if (!zoomState) return;
    emitUiToRuntimeCommand(gameRef.current, UI_TO_RUNTIME_COMMANDS.SET_ZOOM, {
      zoom: zoomState.zoom * 1.1,
    });
  }, [gameRef, zoomState]);

  const onZoomOut = useCallback(() => {
    if (!zoomState) return;
    emitUiToRuntimeCommand(gameRef.current, UI_TO_RUNTIME_COMMANDS.SET_ZOOM, {
      zoom: zoomState.zoom * 0.9,
    });
  }, [gameRef, zoomState]);

  if (!zoomState) {
    return null;
  }

  return {
    zoom: zoomState.zoom,
    minZoom: zoomState.minZoom,
    maxZoom: zoomState.maxZoom,
    onZoomIn,
    onZoomOut,
  };
}

export function useBloomseedTerrainBridge({
  catalog,
  placeables,
  runtimePerf,
}: BloomseedTerrainBridgeOptions): BloomseedTerrainBridge {
  const [inspectedTile, setInspectedTile] = useState<TerrainTileInspectedPayload | null>(null);
  const [activeTerrainTool, setActiveTerrainTool] = useState<SelectedTerrainToolPayload>(null);

  const onClearInspectedTile = useCallback(() => {
    setInspectedTile(null);
  }, []);

  const onSelectTerrainTool = useCallback((tool: SelectedTerrainToolPayload) => {
    setActiveTerrainTool(tool);
    if (tool) {
      setInspectedTile(null);
    }
  }, []);

  return {
    sidebarProps:
      catalog && placeables
        ? {
            catalog,
            placeables,
            inspectedTile,
            onClearInspectedTile,
            activeTerrainTool,
            onSelectTerrainTool,
            runtimePerf,
          }
        : null,
    activeTerrainTool,
    onTerrainTileInspected: setInspectedTile,
  };
}

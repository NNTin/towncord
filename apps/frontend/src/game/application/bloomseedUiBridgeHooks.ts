import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent, MutableRefObject } from "react";
import type Phaser from "phaser";
import type { AnimationCatalog } from "../assets/animationCatalog";
import {
  OFFICE_FLOOR_PICKED_EVENT,
  OFFICE_LAYOUT_CHANGED_EVENT,
  PLACE_DRAG_MIME,
  PLACE_OBJECT_DROP_EVENT,
  PLACE_TERRAIN_DROP_EVENT,
  RUNTIME_PERF_EVENT,
  TERRAIN_TILE_INSPECTED_EVENT,
  ZOOM_CHANGED_EVENT,
  SET_ZOOM_EVENT,
  type OfficeFloorPickedPayload,
  type OfficeLayoutChangedPayload,
  type PlaceObjectDropPayload,
  type PlaceTerrainDropPayload,
  type RuntimePerfPayload,
  type SelectedTerrainToolPayload,
  type TerrainTileInspectedPayload,
  type ZoomChangedPayload,
  parsePlaceDragPayload,
  toPlaceDropPayload,
} from "../events";
import type { OfficeSceneLayout } from "../scenes/office/bootstrap";
import { createGame } from "../phaser/createGame";
import {
  BLOOMSEED_READY_EVENT,
  type BloomseedUiBootstrap,
} from "./gameComposition";
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

function emitPlaceDrop(
  game: Phaser.Game | null,
  payload: PlaceObjectDropPayload | PlaceTerrainDropPayload,
): void {
  if (!game) return;

  if (payload.type === "entity") {
    game.events.emit(PLACE_OBJECT_DROP_EVENT, payload);
    return;
  }

  game.events.emit(PLACE_TERRAIN_DROP_EVENT, payload);
}

function parseRawPlaceDragPayload(rawPayload: string) {
  try {
    return parsePlaceDragPayload(JSON.parse(rawPayload));
  } catch {
    return null;
  }
}

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

    game.events.once(BLOOMSEED_READY_EVENT, handleBootstrap);
    game.events.on(TERRAIN_TILE_INSPECTED_EVENT, handleTerrainTileInspected);
    game.events.on(RUNTIME_PERF_EVENT, handleRuntimePerf);
    game.events.on(ZOOM_CHANGED_EVENT, handleZoomChanged);
    game.events.on(OFFICE_LAYOUT_CHANGED_EVENT, handleOfficeLayoutChanged);
    game.events.on(OFFICE_FLOOR_PICKED_EVENT, handleOfficeFloorPicked);

    return () => {
      game.events.off(TERRAIN_TILE_INSPECTED_EVENT, handleTerrainTileInspected);
      game.events.off(RUNTIME_PERF_EVENT, handleRuntimePerf);
      game.events.off(ZOOM_CHANGED_EVENT, handleZoomChanged);
      game.events.off(OFFICE_LAYOUT_CHANGED_EVENT, handleOfficeLayoutChanged);
      game.events.off(OFFICE_FLOOR_PICKED_EVENT, handleOfficeFloorPicked);
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

    const dragPayload = parseRawPlaceDragPayload(rawPayload);
    if (!dragPayload) return;

    const rect = gameRootRef.current?.getBoundingClientRect();
    if (!rect) return;

    emitPlaceDrop(
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
    gameRef.current?.events.emit(SET_ZOOM_EVENT, { zoom: zoomState.zoom * 1.1 });
  }, [gameRef, zoomState]);

  const onZoomOut = useCallback(() => {
    if (!zoomState) return;
    gameRef.current?.events.emit(SET_ZOOM_EVENT, { zoom: zoomState.zoom * 0.9 });
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

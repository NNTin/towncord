import { useCallback, useEffect, useRef, useState } from "react";
import type { DragEvent, MutableRefObject } from "react";
import type Phaser from "phaser";
import type { AnimationCatalog } from "../assets/animationCatalog";
import {
  PLACE_DRAG_MIME,
  PLACE_OBJECT_DROP_EVENT,
  PLACE_TERRAIN_DROP_EVENT,
  RUNTIME_PERF_EVENT,
  SELECT_TERRAIN_TOOL_EVENT,
  TERRAIN_TILE_INSPECTED_EVENT,
  ZOOM_CHANGED_EVENT,
  SET_ZOOM_EVENT,
  type ZoomChangedPayload,
  type PlaceObjectDropPayload,
  type PlaceTerrainDropPayload,
  type RuntimePerfPayload,
  type SelectedTerrainToolPayload,
  type TerrainTileInspectedPayload,
  parsePlaceDragPayload,
  toPlaceDropPayload,
} from "../events";
import { createGame } from "../phaser/createGame";
import {
  BLOOMSEED_READY_EVENT,
  type BloomseedUiBootstrap,
} from "./gameComposition";
import type { PlaceableViewModel } from "./placeableService";

type BloomseedSidebarBridgeProps = {
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

type BloomseedUiBridge = {
  gameRootRef: MutableRefObject<HTMLDivElement | null>;
  onGameRootDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onGameRootDrop: (event: DragEvent<HTMLDivElement>) => void;
  sidebarProps: BloomseedSidebarBridgeProps | null;
  zoomProps: ZoomControlsProps | null;
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

export function useBloomseedUiBridge(): BloomseedUiBridge {
  const gameRootRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [catalog, setCatalog] = useState<AnimationCatalog | null>(null);
  const [placeables, setPlaceables] = useState<PlaceableViewModel[] | null>(null);
  const [inspectedTile, setInspectedTile] = useState<TerrainTileInspectedPayload | null>(null);
  const [runtimePerf, setRuntimePerf] = useState<RuntimePerfPayload | null>(null);
  const [activeTerrainTool, setActiveTerrainTool] = useState<SelectedTerrainToolPayload>(null);
  const [zoomState, setZoomState] = useState<ZoomChangedPayload | null>(null);

  useEffect(() => {
    const container = gameRootRef.current;
    if (!container) return;

    const game = createGame(container);
    gameRef.current = game;

    function handleBootstrap(payload: BloomseedUiBootstrap): void {
      setCatalog(payload.catalog);
      setPlaceables(payload.placeables);
    }

    function handleTerrainTileInspected(payload: TerrainTileInspectedPayload): void {
      setInspectedTile(payload);
    }

    function handleRuntimePerf(payload: RuntimePerfPayload): void {
      setRuntimePerf(payload);
    }

    game.events.once(BLOOMSEED_READY_EVENT, handleBootstrap);
    game.events.on(TERRAIN_TILE_INSPECTED_EVENT, handleTerrainTileInspected);
    game.events.on(RUNTIME_PERF_EVENT, handleRuntimePerf);

    function handleZoomChanged(payload: ZoomChangedPayload): void {
      setZoomState(payload);
    }
    game.events.on(ZOOM_CHANGED_EVENT, handleZoomChanged);

    return () => {
      game.events.off(TERRAIN_TILE_INSPECTED_EVENT, handleTerrainTileInspected);
      game.events.off(RUNTIME_PERF_EVENT, handleRuntimePerf);
      game.events.off(ZOOM_CHANGED_EVENT, handleZoomChanged);
      game.destroy(true);
      gameRef.current = null;
      setCatalog(null);
      setPlaceables(null);
      setInspectedTile(null);
      setRuntimePerf(null);
      setActiveTerrainTool(null);
      setZoomState(null);
    };
  }, []);

  useEffect(() => {
    gameRef.current?.events.emit(SELECT_TERRAIN_TOOL_EVENT, activeTerrainTool);
  }, [activeTerrainTool]);

  function onGameRootDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function onGameRootDrop(event: DragEvent<HTMLDivElement>): void {
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
  }

  function onClearInspectedTile(): void {
    setInspectedTile(null);
  }

  function onSelectTerrainTool(tool: SelectedTerrainToolPayload): void {
    setActiveTerrainTool(tool);
    if (tool) {
      setInspectedTile(null);
    }
  }

  const onZoomIn = useCallback(() => {
    if (!zoomState) return;
    gameRef.current?.events.emit(SET_ZOOM_EVENT, { zoom: zoomState.zoom * 1.1 });
  }, [zoomState]);

  const onZoomOut = useCallback(() => {
    if (!zoomState) return;
    gameRef.current?.events.emit(SET_ZOOM_EVENT, { zoom: zoomState.zoom * 0.9 });
  }, [zoomState]);

  return {
    gameRootRef,
    onGameRootDragOver,
    onGameRootDrop,
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
    zoomProps: zoomState
      ? {
          zoom: zoomState.zoom,
          minZoom: zoomState.minZoom,
          maxZoom: zoomState.maxZoom,
          onZoomIn,
          onZoomOut,
        }
      : null,
  };
}

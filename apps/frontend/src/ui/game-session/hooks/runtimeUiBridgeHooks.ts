import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { MutableRefObject } from "react";
import type { OfficeFloorPickedPayload } from "../../../game/contracts/office-editor";
import type { OfficeSceneLayout } from "../../../game/contracts/office-scene";
import type {
  RuntimeBootstrapPayload,
  RuntimePerfPayload,
  RuntimeZoomState,
  TerrainTileInspectedPayload,
  TerrainToolSelection,
} from "../../../game/contracts/runtime";
import {
  PLACE_DRAG_MIME,
  createRuntimeBridgeState,
  parsePlaceDragMimePayload,
  reduceRuntimeBridgeState,
  selectRuntimeSidebarProjection,
} from "../../../game";
import type { GameSession, GameSessionFactory } from "../../../game/session";
import { gameSessionFactory } from "../../../game/session";
import type { RuntimeRootBindings, ZoomControlsViewModel } from "../contracts";

function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

type RuntimeGatewayLifecycleOptions = {
  sessionFactory?: GameSessionFactory;
  onBootstrap: (payload: RuntimeBootstrapPayload) => void;
  onTerrainTileInspected: (payload: TerrainTileInspectedPayload) => void;
  onRuntimeDiagnostics: (payload: RuntimePerfPayload) => void;
  onZoomChanged: (payload: RuntimeZoomState) => void;
  onOfficeLayoutChanged?: ((layout: OfficeSceneLayout) => void) | undefined;
  onOfficeFloorPicked?:
    | ((payload: OfficeFloorPickedPayload) => void)
    | undefined;
};

type RuntimeInteractionOptions = {
  runtimeRootRef: MutableRefObject<HTMLDivElement | null>;
  sessionRef: MutableRefObject<GameSession | null>;
  zoomState: RuntimeZoomState | null;
};

export function useRuntimeGatewayLifecycle({
  sessionFactory = gameSessionFactory,
  onBootstrap,
  onTerrainTileInspected,
  onRuntimeDiagnostics,
  onZoomChanged,
  onOfficeLayoutChanged,
  onOfficeFloorPicked,
}: RuntimeGatewayLifecycleOptions): {
  runtimeRootRef: MutableRefObject<HTMLDivElement | null>;
  sessionRef: MutableRefObject<GameSession | null>;
} {
  const runtimeRootRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const onBootstrapRef = useLatestRef(onBootstrap);
  const onTerrainTileInspectedRef = useLatestRef(onTerrainTileInspected);
  const onRuntimeDiagnosticsRef = useLatestRef(onRuntimeDiagnostics);
  const onZoomChangedRef = useLatestRef(onZoomChanged);
  const onOfficeLayoutChangedRef = useLatestRef(onOfficeLayoutChanged);
  const onOfficeFloorPickedRef = useLatestRef(onOfficeFloorPicked);

  useEffect(() => {
    const container = runtimeRootRef.current;
    if (!container) {
      return;
    }

    const session = sessionFactory.mount(container);
    sessionRef.current = session;
    const unsubscribe = session.subscribe({
      onBootstrap(payload) {
        onBootstrapRef.current(payload);
      },
      onTerrainTileInspected(payload) {
        onTerrainTileInspectedRef.current(payload);
      },
      onRuntimeDiagnostics(payload) {
        onRuntimeDiagnosticsRef.current(payload);
      },
      onZoomChanged(payload) {
        onZoomChangedRef.current(payload);
      },
      onOfficeLayoutChanged(layout) {
        onOfficeLayoutChangedRef.current?.(layout);
      },
      onOfficeFloorPicked(payload) {
        onOfficeFloorPickedRef.current?.(payload);
      },
    });

    return () => {
      unsubscribe();
      session.destroy();
      if (sessionRef.current === session) {
        sessionRef.current = null;
      }
    };
  }, [sessionFactory]);

  return {
    runtimeRootRef,
    sessionRef,
  };
}

export function createRuntimeInteractionAdapter({
  runtimeRootRef,
  sessionRef,
  zoomState,
}: RuntimeInteractionOptions): {
  runtimeRootBindings: RuntimeRootBindings;
  zoomViewModel: ZoomControlsViewModel | null;
} {
  const onDragOver: RuntimeRootBindings["onDragOver"] = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const onDrop: RuntimeRootBindings["onDrop"] = (event) => {
    event.preventDefault();

    const rawPayload = event.dataTransfer.getData(PLACE_DRAG_MIME);
    if (!rawPayload) {
      return;
    }

    const dragPayload = parsePlaceDragMimePayload(rawPayload);
    if (!dragPayload) {
      return;
    }

    const rect = runtimeRootRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    sessionRef.current?.placeDragDrop(dragPayload, {
      screenX: event.clientX - rect.left,
      screenY: event.clientY - rect.top,
    });
  };

  const onZoomIn = (): void => {
    if (!zoomState) {
      return;
    }

    sessionRef.current?.setZoom(zoomState.zoom * 1.1);
  };

  const onZoomOut = (): void => {
    if (!zoomState) {
      return;
    }

    sessionRef.current?.setZoom(zoomState.zoom * 0.9);
  };

  return {
    runtimeRootBindings: {
      onDragOver,
      onDrop,
    },
    zoomViewModel: zoomState
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

export function useRuntimeInteractionAdapter(
  options: RuntimeInteractionOptions,
): {
  runtimeRootBindings: RuntimeRootBindings;
  zoomViewModel: ZoomControlsViewModel | null;
} {
  return useMemo(
    () => createRuntimeInteractionAdapter(options),
    [options.runtimeRootRef, options.sessionRef, options.zoomState],
  );
}

export function useRuntimeSyncAdapter(): {
  activeTerrainTool: TerrainToolSelection;
  onBootstrap: (payload: RuntimeBootstrapPayload) => void;
  onClearInspectedTile: () => void;
  onRuntimeDiagnostics: (payload: RuntimePerfPayload) => void;
  onSelectTerrainTool: (tool: TerrainToolSelection) => void;
  onTerrainTileInspected: (payload: TerrainTileInspectedPayload) => void;
  onZoomChanged: (payload: RuntimeZoomState) => void;
  runtimeSidebarProjection: ReturnType<typeof selectRuntimeSidebarProjection>;
  zoomState: RuntimeZoomState | null;
} {
  const [state, dispatch] = useReducer(
    reduceRuntimeBridgeState,
    undefined,
    createRuntimeBridgeState,
  );

  const onBootstrap = useCallback((payload: RuntimeBootstrapPayload) => {
    dispatch({ type: "runtimeBootstrapped", payload });
  }, []);

  const onTerrainTileInspected = useCallback(
    (payload: TerrainTileInspectedPayload) => {
      dispatch({ type: "terrainTileInspected", payload });
    },
    [],
  );

  const onRuntimeDiagnostics = useCallback((payload: RuntimePerfPayload) => {
    dispatch({ type: "runtimeDiagnosticsUpdated", payload });
  }, []);

  const onZoomChanged = useCallback((payload: RuntimeZoomState) => {
    dispatch({ type: "zoomChanged", payload });
  }, []);

  const onSelectTerrainTool = useCallback((tool: TerrainToolSelection) => {
    dispatch({ type: "terrainToolSelected", tool });
  }, []);

  const onClearInspectedTile = useCallback(() => {
    dispatch({ type: "inspectedTileCleared" });
  }, []);

  return {
    activeTerrainTool: state.activeTerrainTool,
    onBootstrap,
    onClearInspectedTile,
    onRuntimeDiagnostics,
    onSelectTerrainTool,
    onTerrainTileInspected,
    onZoomChanged,
    runtimeSidebarProjection: selectRuntimeSidebarProjection(state),
    zoomState: state.zoomState,
  };
}

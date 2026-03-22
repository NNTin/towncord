import { useCallback, useEffect, useReducer, useRef } from "react";
import type { MutableRefObject } from "react";
import {
  PLACE_DRAG_MIME,
  parsePlaceDragMimePayload,
  type OfficeFloorPickedPayload,
} from "../protocol";
import type { OfficeSceneLayout } from "../scenes/office/bootstrap";
import {
  bloomseedRuntimeGateway,
  type RuntimeBootstrap,
  type RuntimeDiagnostics,
  type RuntimeGateway,
  type RuntimeGatewaySession,
  type RuntimeTerrainInspection,
  type RuntimeTerrainToolSelection,
  type RuntimeZoomState,
} from "./runtimeGateway";
import {
  createRuntimeBridgeState,
  reduceRuntimeBridgeState,
  selectRuntimeSidebarProjection,
} from "./runtimeBridgeState";
import type {
  RuntimeRootBindings,
  ZoomControlsViewModel,
} from "./runtimeViewModels";

function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

type RuntimeGatewayLifecycleOptions = {
  gateway?: RuntimeGateway;
  onBootstrap: (payload: RuntimeBootstrap) => void;
  onTerrainTileInspected: (payload: RuntimeTerrainInspection) => void;
  onRuntimeDiagnostics: (payload: RuntimeDiagnostics) => void;
  onZoomChanged: (payload: RuntimeZoomState) => void;
  onOfficeLayoutChanged?: ((layout: OfficeSceneLayout) => void) | undefined;
  onOfficeFloorPicked?: ((payload: OfficeFloorPickedPayload) => void) | undefined;
};

type RuntimeInteractionOptions = {
  runtimeRootRef: MutableRefObject<HTMLDivElement | null>;
  sessionRef: MutableRefObject<RuntimeGatewaySession | null>;
  zoomState: RuntimeZoomState | null;
};

export function useRuntimeGatewayLifecycle({
  gateway = bloomseedRuntimeGateway,
  onBootstrap,
  onTerrainTileInspected,
  onRuntimeDiagnostics,
  onZoomChanged,
  onOfficeLayoutChanged,
  onOfficeFloorPicked,
}: RuntimeGatewayLifecycleOptions): {
  runtimeRootRef: MutableRefObject<HTMLDivElement | null>;
  sessionRef: MutableRefObject<RuntimeGatewaySession | null>;
} {
  const runtimeRootRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<RuntimeGatewaySession | null>(null);
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

    const session = gateway.mount(container);
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
  }, [gateway]);

  return {
    runtimeRootRef,
    sessionRef,
  };
}

export function useRuntimeInteractionAdapter({
  runtimeRootRef,
  sessionRef,
  zoomState,
}: RuntimeInteractionOptions): {
  runtimeRootBindings: RuntimeRootBindings;
  zoomViewModel: ZoomControlsViewModel | null;
} {
  const onDragOver = useCallback<RuntimeRootBindings["onDragOver"]>((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback<RuntimeRootBindings["onDrop"]>(
    (event) => {
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
    },
    [runtimeRootRef, sessionRef],
  );

  const onZoomIn = useCallback(() => {
    if (!zoomState) {
      return;
    }

    sessionRef.current?.setZoom(zoomState.zoom * 1.1);
  }, [sessionRef, zoomState]);

  const onZoomOut = useCallback(() => {
    if (!zoomState) {
      return;
    }

    sessionRef.current?.setZoom(zoomState.zoom * 0.9);
  }, [sessionRef, zoomState]);

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

export function useRuntimeSyncAdapter(): {
  activeTerrainTool: RuntimeTerrainToolSelection;
  onBootstrap: (payload: RuntimeBootstrap) => void;
  onClearInspectedTile: () => void;
  onRuntimeDiagnostics: (payload: RuntimeDiagnostics) => void;
  onSelectTerrainTool: (tool: RuntimeTerrainToolSelection) => void;
  onTerrainTileInspected: (payload: RuntimeTerrainInspection) => void;
  onZoomChanged: (payload: RuntimeZoomState) => void;
  runtimeSidebarProjection: ReturnType<typeof selectRuntimeSidebarProjection>;
  zoomState: RuntimeZoomState | null;
} {
  const [state, dispatch] = useReducer(
    reduceRuntimeBridgeState,
    undefined,
    createRuntimeBridgeState,
  );

  const onBootstrap = useCallback((payload: RuntimeBootstrap) => {
    dispatch({ type: "runtimeBootstrapped", payload });
  }, []);

  const onTerrainTileInspected = useCallback(
    (payload: RuntimeTerrainInspection) => {
      dispatch({ type: "terrainTileInspected", payload });
    },
    [],
  );

  const onRuntimeDiagnostics = useCallback((payload: RuntimeDiagnostics) => {
    dispatch({ type: "runtimeDiagnosticsUpdated", payload });
  }, []);

  const onZoomChanged = useCallback((payload: RuntimeZoomState) => {
    dispatch({ type: "zoomChanged", payload });
  }, []);

  const onSelectTerrainTool = useCallback((tool: RuntimeTerrainToolSelection) => {
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

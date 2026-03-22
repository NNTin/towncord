import { useEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import type {
  PreviewAnimationRequest,
  PreviewRuntimeGateway,
  PreviewRuntimeGatewaySession,
  PreviewRuntimeState,
  RuntimeTerrainInspection,
} from "./runtimeGateway";
import {
  previewRuntimeGateway,
} from "./runtimeGateway";

function toPreviewTilePayload(
  inspectedTile: RuntimeTerrainInspection,
): Parameters<PreviewRuntimeGatewaySession["showTile"]>[0] {
  return {
    textureKey: inspectedTile.textureKey,
    frame: inspectedTile.frame,
    caseId: inspectedTile.caseId,
    materialId: inspectedTile.materialId,
    cellX: inspectedTile.cellX,
    cellY: inspectedTile.cellY,
    rotate90: inspectedTile.rotate90,
    flipX: inspectedTile.flipX,
    flipY: inspectedTile.flipY,
  };
}

export function createPreviewRuntimeAdapter(args: {
  onInfo: (info: PreviewRuntimeState | null) => void;
  sessionRef: MutableRefObject<PreviewRuntimeGatewaySession | null>;
}): {
  showPreviewAnimation: (
    previewAnimation: PreviewAnimationRequest | null,
    previewTile: RuntimeTerrainInspection | null,
  ) => void;
  showPreviewTile: (previewTile: RuntimeTerrainInspection | null) => void;
} {
  return {
    showPreviewAnimation(previewAnimation, previewTile) {
      if (previewTile) {
        return;
      }

      if (!previewAnimation) {
        args.onInfo(null);
        return;
      }

      args.sessionRef.current?.showAnimation(previewAnimation);
    },
    showPreviewTile(previewTile) {
      if (!previewTile) {
        return;
      }

      args.sessionRef.current?.showTile(toPreviewTilePayload(previewTile));
    },
  };
}

export function usePreviewRuntime(options: {
  gateway?: PreviewRuntimeGateway;
  previewTile: RuntimeTerrainInspection | null;
  previewAnimation: PreviewAnimationRequest | null;
  onInfo: (info: PreviewRuntimeState | null) => void;
}): MutableRefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<PreviewRuntimeGatewaySession | null>(null);
  const onInfoRef = useRef(options.onInfo);
  onInfoRef.current = options.onInfo;
  const adapter = useMemo(
    () =>
      createPreviewRuntimeAdapter({
        onInfo(info) {
          onInfoRef.current(info);
        },
        sessionRef,
      }),
    [sessionRef],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const session = (options.gateway ?? previewRuntimeGateway).mount(container);
    sessionRef.current = session;
    const unsubscribe = session.subscribe({
      onInfo(info) {
        onInfoRef.current(info);
      },
    });

    return () => {
      unsubscribe();
      session.destroy();
      if (sessionRef.current === session) {
        sessionRef.current = null;
      }
    };
  }, [options.gateway]);

  useEffect(() => {
    adapter.showPreviewTile(options.previewTile);
  }, [adapter, options.previewTile]);

  useEffect(() => {
    adapter.showPreviewAnimation(options.previewAnimation, options.previewTile);
  }, [adapter, options.previewAnimation, options.previewTile]);

  return containerRef;
}

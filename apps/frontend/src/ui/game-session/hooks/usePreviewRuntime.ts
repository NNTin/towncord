import { useEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import {
  createPreviewRuntimeAdapter,
  type PreviewRuntimeState,
  type RuntimeTerrainInspection,
} from "../../../game";
import type { PreviewAnimationRequest } from "../../../game/contracts/preview";
import type {
  PreviewSession,
  PreviewSessionFactory,
} from "../../../game/session";
import { previewSessionFactory } from "../../../game/session";

export function usePreviewRuntime(options: {
  sessionFactory?: PreviewSessionFactory;
  previewTile: RuntimeTerrainInspection | null;
  previewAnimation: PreviewAnimationRequest | null;
  onInfo: (info: PreviewRuntimeState | null) => void;
}): MutableRefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<PreviewSession | null>(null);
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

    const session = (options.sessionFactory ?? previewSessionFactory).mount(
      container,
    );
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
  }, [options.sessionFactory]);

  useEffect(() => {
    adapter.showPreviewTile(options.previewTile);
  }, [adapter, options.previewTile]);

  useEffect(() => {
    adapter.showPreviewAnimation(options.previewAnimation, options.previewTile);
  }, [adapter, options.previewAnimation, options.previewTile]);

  return containerRef;
}

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import Phaser from "phaser";
import {
  PreviewScene,
  PREVIEW_INFO_EVENT,
  PREVIEW_PLAY_EVENT,
  PREVIEW_READY_EVENT,
  PREVIEW_SHOW_TILE_EVENT,
  type PreviewInfo,
  type PreviewPlayPayload,
  type PreviewShowTilePayload,
} from "../scenes/PreviewScene";
import type { RuntimeTerrainInspection } from "./runtimeGateway";

const PREVIEW_WIDTH = 164;
const PREVIEW_HEIGHT = 130;

type PreviewRuntimeSession = {
  destroy: () => void;
  onInfo: (handler: (info: PreviewInfo) => void) => () => void;
  play: (payload: PreviewPlayPayload) => void;
  showTile: (payload: PreviewShowTilePayload) => void;
};

function createPreviewRuntimeSession(container: HTMLElement): PreviewRuntimeSession {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    backgroundColor: "#0f172a",
    parent: container,
    scene: [PreviewScene],
    input: { keyboard: false },
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.NONE },
    disableContextMenu: true,
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      antialiasGL: false,
    },
  });

  let destroyed = false;
  let ready = false;
  let pendingPlay: PreviewPlayPayload | null = null;
  let pendingTile: PreviewShowTilePayload | null = null;
  const infoHandlers = new Set<(info: PreviewInfo) => void>();

  const emitWhenReady = (
    eventName: typeof PREVIEW_PLAY_EVENT | typeof PREVIEW_SHOW_TILE_EVENT,
    payload: PreviewPlayPayload | PreviewShowTilePayload,
  ): void => {
    if (destroyed) {
      return;
    }

    if (ready) {
      game.events.emit(eventName, payload);
      return;
    }

    if (eventName === PREVIEW_SHOW_TILE_EVENT) {
      pendingTile = payload as PreviewShowTilePayload;
      pendingPlay = null;
      return;
    }

    pendingPlay = payload as PreviewPlayPayload;
  };

  const handleReady = (): void => {
    ready = true;
    if (pendingTile) {
      game.events.emit(PREVIEW_SHOW_TILE_EVENT, pendingTile);
      pendingTile = null;
      return;
    }

    if (pendingPlay) {
      game.events.emit(PREVIEW_PLAY_EVENT, pendingPlay);
      pendingPlay = null;
    }
  };

  const handleInfo = (info: PreviewInfo): void => {
    for (const handler of infoHandlers) {
      handler(info);
    }
  };

  game.events.once(PREVIEW_READY_EVENT, handleReady);
  game.events.on(PREVIEW_INFO_EVENT, handleInfo);

  return {
    destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;
      infoHandlers.clear();
      game.events.off(PREVIEW_INFO_EVENT, handleInfo);
      game.destroy(true);
    },
    onInfo(handler) {
      if (destroyed) {
        return () => {};
      }

      infoHandlers.add(handler);
      return () => {
        infoHandlers.delete(handler);
      };
    },
    play(payload) {
      emitWhenReady(PREVIEW_PLAY_EVENT, payload);
    },
    showTile(payload) {
      emitWhenReady(PREVIEW_SHOW_TILE_EVENT, payload);
    },
  };
}

function toPreviewTilePayload(
  inspectedTile: RuntimeTerrainInspection,
): PreviewShowTilePayload {
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

export function usePreviewRuntime(options: {
  previewTile: RuntimeTerrainInspection | null;
  previewAnimation: PreviewPlayPayload | null;
  onInfo: (info: PreviewInfo | null) => void;
}): MutableRefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<PreviewRuntimeSession | null>(null);
  const onInfoRef = useRef(options.onInfo);
  onInfoRef.current = options.onInfo;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const session = createPreviewRuntimeSession(container);
    sessionRef.current = session;
    const unsubscribe = session.onInfo((info) => {
      onInfoRef.current(info);
    });

    return () => {
      unsubscribe();
      session.destroy();
      if (sessionRef.current === session) {
        sessionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!options.previewTile) {
      return;
    }

    sessionRef.current?.showTile(toPreviewTilePayload(options.previewTile));
  }, [options.previewTile]);

  useEffect(() => {
    if (options.previewTile) {
      return;
    }

    if (!options.previewAnimation) {
      onInfoRef.current(null);
      return;
    }

    sessionRef.current?.play(options.previewAnimation);
  }, [options.previewAnimation, options.previewTile]);

  return containerRef;
}

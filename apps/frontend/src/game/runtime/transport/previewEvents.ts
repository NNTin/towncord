import type {
  PreviewAnimationRequest,
  PreviewRuntimeInfo,
  PreviewTileRequest,
} from "../../contracts/preview";
import type { RuntimeEventHost } from "./host";

export const PREVIEW_READY_EVENT = "preview:ready";
export const PREVIEW_PLAY_EVENT = "preview:play";
export const PREVIEW_SHOW_TILE_EVENT = "preview:showTile";
export const PREVIEW_INFO_EVENT = "preview:info";

export type {
  PreviewAnimationRequest,
  PreviewRuntimeInfo,
  PreviewTileRequest,
} from "../../contracts/preview";

export function emitPreviewRuntimeEvent(
  host: RuntimeEventHost | null | undefined,
  event: string,
  payload?: unknown,
): void {
  host?.events.emit(event, payload);
}

export function bindPreviewRuntimeEvent<T>(
  host: RuntimeEventHost,
  event: string,
  handler: (payload: T) => void,
  context?: unknown,
): () => void {
  const wrapped = (payload: unknown): void => {
    handler(payload as T);
  };

  host.events.on(event, wrapped, context);
  return () => {
    host.events.off(event, wrapped, context);
  };
}

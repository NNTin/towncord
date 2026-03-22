import {
  RUNTIME_TO_UI_EVENTS,
  emitRuntimeToUiEvent,
  type OfficeFloorPickedPayload,
  type OfficeLayoutChangedPayload,
  type PlayerPlacedPayload,
  type PlayerStateChangedPayload,
  type RuntimePerfPayload,
  type RuntimeToUiEventName,
  type RuntimeToUiEventPayloadByName,
  type TerrainTileInspectedPayload,
  type ZoomChangedPayload,
} from "../../protocol";

type RuntimeProjectionHost = {
  getRuntimeHost: () =>
    | {
        events: {
          emit: (event: string, payload: unknown) => void;
          on: (event: string, fn: (payload: unknown) => void, context?: unknown) => void;
          off: (event: string, fn: (payload: unknown) => void, context?: unknown) => void;
        };
      }
    | null
    | undefined;
};

export class WorldSceneProjectionEmitter {
  constructor(private readonly host: RuntimeProjectionHost) {}

  public emitTerrainTileInspected(payload: TerrainTileInspectedPayload): void {
    this.emitProjection(RUNTIME_TO_UI_EVENTS.TERRAIN_TILE_INSPECTED, payload);
  }

  public emitPlayerPlaced(payload: PlayerPlacedPayload): void {
    this.emitProjection(RUNTIME_TO_UI_EVENTS.PLAYER_PLACED, payload);
  }

  public emitPlayerStateChanged(payload: PlayerStateChangedPayload): void {
    this.emitProjection(RUNTIME_TO_UI_EVENTS.PLAYER_STATE_CHANGED, payload);
  }

  public emitRuntimePerf(payload: RuntimePerfPayload): void {
    this.emitProjection(RUNTIME_TO_UI_EVENTS.RUNTIME_PERF, payload);
  }

  public emitZoomChanged(payload: ZoomChangedPayload): void {
    this.emitProjection(RUNTIME_TO_UI_EVENTS.ZOOM_CHANGED, payload);
  }

  public emitOfficeFloorPicked(payload: OfficeFloorPickedPayload): void {
    this.emitProjection(RUNTIME_TO_UI_EVENTS.OFFICE_FLOOR_PICKED, payload);
  }

  public emitOfficeLayoutChanged(payload: OfficeLayoutChangedPayload): void {
    this.emitProjection(RUNTIME_TO_UI_EVENTS.OFFICE_LAYOUT_CHANGED, payload);
  }

  private emitProjection<K extends RuntimeToUiEventName>(
    event: K,
    payload: RuntimeToUiEventPayloadByName[K],
  ): void {
    emitRuntimeToUiEvent(this.host.getRuntimeHost(), event, payload);
  }
}

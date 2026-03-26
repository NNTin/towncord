export type WorldRuntimePerfPayload = {
  timestampMs: number;
  fps: number;
  frameMs: number;
  updateMs: number;
  terrainMs: number;
};

export type WorldRuntimeZoomChangedPayload = {
  zoom: number;
  minZoom: number;
  maxZoom: number;
};

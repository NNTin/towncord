export const PREVIEW_READY_EVENT = "preview:ready";
export const PREVIEW_PLAY_EVENT = "preview:play";
export const PREVIEW_SHOW_TILE_EVENT = "preview:showTile";
export const PREVIEW_INFO_EVENT = "preview:info";

export type PreviewAnimationRequest = {
  key: string;
  flipX: boolean;
  equipKey: string | null;
  equipFlipX: boolean;
  frameIndex?: number | null;
};

export type PreviewTileRequest = {
  textureKey: string;
  frame: string;
  caseId: number;
  materialId: string;
  cellX: number;
  cellY: number;
  rotate90: 0 | 1 | 2 | 3;
  flipX: boolean;
  flipY: boolean;
};

export type PreviewRuntimeInfo = {
  sourceType: "animation" | "terrain-tile";
  animationKey: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  flipX: boolean;
  flipY: boolean;
  scale: number;
  displayWidth: number;
  displayHeight: number;
  caseId?: number;
  materialId?: string;
  cellX?: number;
  cellY?: number;
  rotate90?: 0 | 1 | 2 | 3;
};

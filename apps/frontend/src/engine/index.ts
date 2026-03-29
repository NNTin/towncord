export type { PreviewSceneLifecycleAdapter } from "./preview-runtime/scene";
export { PREVIEW_SCENE_KEY } from "./preview-runtime/scene";

export {
  RUNTIME_BOOT_SCENE_KEY,
  RUNTIME_PRELOAD_SCENE_KEY,
  RUNTIME_WORLD_SCENE_KEY,
} from "./world-runtime/scene";
export type {
  PreloadSceneLifecycleAdapter,
  WorldSceneLifecycleAdapter,
} from "./world-runtime/scene";

export { WorldRuntimeCameraController } from "./world-runtime/camera/worldRuntimeCameraController";
export { WorldRuntimeDiagnosticsController } from "./world-runtime/diagnostics/worldRuntimeDiagnosticsController";
export { WorldRuntimeInputRouter } from "./world-runtime/input/worldRuntimeInputRouter";
export {
  WORLD_REGION_BASE_PX,
  anchoredGridCellToWorldPixel,
  isPointInsideAnchoredGridRegion,
  worldToAnchoredGridCell,
  type AnchoredGridCellCoord,
  type AnchoredGridRegion,
} from "./world-runtime/regions";
export { UnifiedCollisionMap } from "./world-runtime/spatial";
export {
  createTerrainNavigationService,
  doesFurnitureBlockMovement,
  shouldTreatFurnitureOverlapAsExclusive,
  type FurniturePlacementLike,
  type AutonomyNavigationService,
  type WorldNavigationService,
} from "./world-runtime/spatial";

export * from "./terrain";
export * from "./structures";

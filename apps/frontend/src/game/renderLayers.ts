/**
 * Centralized render-layer depth taxonomy for the world scene.
 *
 * Phaser renders game objects in ascending depth order (lower depth = further
 * back). Depths are integers chosen to leave room for sub-layers and future
 * additions; do NOT use arbitrary values elsewhere — always refer to this
 * object.
 *
 * Layer budget overview (most-negative → most-positive):
 *
 *   TERRAIN_STATIC   -1000   ← terrain chunk render-textures (static tiles)
 *   TERRAIN_ANIMATED  -999   ← terrain chunk render-textures (animated tiles, drawn on top of static within same chunk)
 *   OFFICE_FLOOR      -500   ← office tile graphics layer (floor tiles only; walls use y-sorted depth)
 *   ENTITIES           y-sorted (entity.position.y, roughly 0..map-height in world pixels)
 *   OFFICE_CELL_HIGHLIGHT  8000   ← hover-highlight overlay for office editor
 *   TERRAIN_BRUSH_PREVIEW  9000   ← terrain-paint brush hover rectangle
 *   UI_OVERLAY        10000  ← HUD elements drawn above everything (selection badge, etc.)
 */
export const RENDER_LAYERS = {
  /**
   * Depth for static (non-animated) terrain chunk render-textures.
   * One render-texture per chunk; sits at the back of the scene.
   */
  TERRAIN_STATIC: -1_000,

  /**
   * Depth for animated terrain chunk render-textures.
   * One slot above TERRAIN_STATIC so animated tiles always draw on top of the
   * static layer within the same chunk without any additional sorting.
   */
  TERRAIN_ANIMATED: -999,

  /**
   * Depth for the office floor tile graphics layer.
   * Sits above terrain and below world entities.
   * Wall tiles are rendered as scene-level sprites with y-sorted depth so
   * entities can pass in front of or behind them correctly.
   */
  OFFICE_FLOOR: -500,

  /**
   * Depth for the office-cell hover highlight shown while the office editor
   * tool is active. Rendered above all entities.
   */
  OFFICE_CELL_HIGHLIGHT: 8_000,

  /**
   * Depth for the terrain brush preview rectangle (paint-tool hover outline).
   */
  TERRAIN_BRUSH_PREVIEW: 9_000,

  /**
   * Depth for UI overlay elements that must always render above the world
   * (e.g. the entity selection badge).
   */
  UI_OVERLAY: 10_000,
} as const;

import type Phaser from "phaser";

/**
 * Narrow lifecycle contract implemented by the game-owned preview adapter.
 *
 * The engine-owned preview scene shell calls these methods from the correct
 * Phaser lifecycle phases. The adapter owns all game-specific preview content
 * loading, animation registration, event binding, sprite behavior, and
 * preview info emission.
 */
export type PreviewSceneLifecycleAdapter = {
  /**
   * Called once from the Phaser scene `preload()` phase.
   * The adapter should queue generated asset packs used by the preview runtime.
   */
  preload(scene: Phaser.Scene): void;
  /**
   * Called once from the Phaser scene `create()` phase.
   * The adapter should register preview animations, bind preview transport
   * events, create any sprite state needed, and emit the preview-ready event.
   */
  create(scene: Phaser.Scene): void;
  /**
   * Called on scene shutdown.
   * The adapter should unbind preview transport event listeners and clear
   * any sprite or controller state.
   */
  dispose(): void;
};

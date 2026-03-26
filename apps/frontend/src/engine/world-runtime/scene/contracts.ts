import type Phaser from "phaser";

/**
 * Narrow lifecycle contract implemented by the game-owned preload adapter.
 *
 * The engine-owned preload scene shell calls these methods from the correct
 * Phaser lifecycle phases. The adapter owns all game-specific content loading,
 * bootstrap composition, registry publication, and scene transition.
 */
export type PreloadSceneLifecycleAdapter = {
  /**
   * Called once from the Phaser scene `preload()` phase.
   * The adapter should queue generated asset packs for the main world runtime.
   */
  preload(scene: Phaser.Scene): void;
  /**
   * Called once from the Phaser scene `create()` phase.
   * The adapter should register preload animations, compose runtime bootstrap,
   * publish registry values, emit the runtime-ready event, and start the world scene.
   */
  create(scene: Phaser.Scene): void;
};

/**
 * Narrow lifecycle contract implemented by the game-owned world scene adapter.
 *
 * The engine-owned world scene shell calls these methods in the correct order
 * and at the correct Phaser lifecycle moments. The adapter owns game-specific
 * bootstrap, assembly construction, protocol binding, and input delegation.
 *
 * The engine-owned world scene shell calls these methods in the correct order
 * and at the correct Phaser lifecycle moments. The adapter owns game-specific
 * bootstrap, assembly construction, protocol binding, and input delegation.
 */
export type WorldSceneLifecycleAdapter = {
  /**
   * Called once from the Phaser scene `create()` phase.
   * The adapter should read bootstrap data from the registry, construct
   * WorldSceneAssembly, and bind protocol listeners.
   */
  boot(scene: Phaser.Scene): void;
  /**
   * Called every frame from the Phaser scene `update()`.
   */
  update(delta: number): void;
  /**
   * Called on scene shutdown. The adapter should unbind protocol listeners
   * and dispose all runtime systems.
   */
  dispose(): void;
  onPointerDown(pointer: Phaser.Input.Pointer): void;
  onPointerMove(pointer: Phaser.Input.Pointer): void;
  onPointerUp(pointer: Phaser.Input.Pointer): void;
  /**
   * @param dy - wheel delta y
   * @param activePointer - the current active pointer from scene.input
   */
  onWheel(dy: number, activePointer: Phaser.Input.Pointer): void;
  /**
   * Called after the first resize event following scene creation.
   */
  onResize(): void;
};

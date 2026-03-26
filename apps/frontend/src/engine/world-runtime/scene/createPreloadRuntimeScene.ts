import Phaser from "phaser";
import type { PreloadSceneLifecycleAdapter } from "./contracts";
import { RUNTIME_PRELOAD_SCENE_KEY } from "./runtimeSceneKeys";

/**
 * Returns an engine-owned Phaser scene constructor for the world runtime preload phase.
 *
 * The scene shell owns:
 * - Phaser scene subclassing and scene key registration
 * - invoking adapter.preload(this) from preload()
 * - invoking adapter.create(this) from create()
 *
 * All game-specific content loading, bootstrap composition, registry publication,
 * runtime-ready event emission, and scene transition are delegated to the injected adapter.
 * This module must not import game assets, game application, or game scene modules.
 */
export function createPreloadRuntimeScene(
  adapter: PreloadSceneLifecycleAdapter,
): typeof Phaser.Scene {
  class PreloadRuntimeScene extends Phaser.Scene {
    constructor() {
      super(RUNTIME_PRELOAD_SCENE_KEY);
    }

    public preload(): void {
      adapter.preload(this);
    }

    public create(): void {
      adapter.create(this);
    }
  }

  return PreloadRuntimeScene;
}

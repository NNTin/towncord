import Phaser from "phaser";
import type { PreviewSceneLifecycleAdapter } from "./contracts";
import { PREVIEW_SCENE_KEY } from "./previewSceneKeys";

/**
 * Returns an engine-owned Phaser scene constructor for the preview runtime.
 *
 * The scene shell owns:
 * - Phaser scene subclassing and scene key registration
 * - invoking adapter.preload(this) from preload()
 * - invoking adapter.create(this) from create()
 * - invoking adapter.dispose() on scene shutdown
 *
 * All preview-specific content loading, animation registration, event binding,
 * sprite rendering, and preview info emission are delegated to the injected
 * adapter. This module must not import game assets, game application, or game
 * scene modules.
 */
export function createPreviewRuntimeScene(
  adapter: PreviewSceneLifecycleAdapter,
): typeof Phaser.Scene {
  class PreviewRuntimeScene extends Phaser.Scene {
    constructor() {
      super(PREVIEW_SCENE_KEY);
    }

    public preload(): void {
      adapter.preload(this);
    }

    public create(): void {
      adapter.create(this);
      this.events.once("shutdown", () => {
        adapter.dispose();
      });
    }
  }

  return PreviewRuntimeScene;
}

import Phaser from "phaser";
import { RUNTIME_BOOT_SCENE_KEY, RUNTIME_PRELOAD_SCENE_KEY } from "./runtimeSceneKeys";

class BootRuntimeScene extends Phaser.Scene {
  constructor() {
    super(RUNTIME_BOOT_SCENE_KEY);
  }

  public create(): void {
    this.scene.start(RUNTIME_PRELOAD_SCENE_KEY);
  }
}

/**
 * Returns the engine-owned boot scene constructor.
 * The boot scene transitions immediately to the preload scene.
 */
export function createBootRuntimeScene(): typeof Phaser.Scene {
  return BootRuntimeScene;
}

import Phaser from "phaser";

export const BOOT_SCENE_KEY = "boot";
export const PRELOAD_SCENE_KEY = "preload";

export class BootScene extends Phaser.Scene {
  constructor() {
    super(BOOT_SCENE_KEY);
  }

  public create(): void {
    this.scene.start(PRELOAD_SCENE_KEY);
  }
}

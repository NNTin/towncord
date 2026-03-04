import Phaser from "phaser";
import { registerBloomseedAnimations } from "../assets/animation";
import { preloadBloomseedPack } from "../assets/preload";
import { PRELOAD_SCENE_KEY } from "./BootScene";
import { WORLD_SCENE_KEY } from "./WorldScene";

export const BLOOMSEED_ANIMATION_KEYS_REGISTRY_KEY = "bloomseed.animationKeys";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(PRELOAD_SCENE_KEY);
  }

  public preload(): void {
    preloadBloomseedPack(this);
  }

  public create(): void {
    const animationKeys = registerBloomseedAnimations(this);
    this.registry.set(BLOOMSEED_ANIMATION_KEYS_REGISTRY_KEY, animationKeys);
    this.game.events.emit("bloomseedReady", animationKeys);
    this.scene.start(WORLD_SCENE_KEY);
  }
}

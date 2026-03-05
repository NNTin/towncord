import Phaser from "phaser";
import {
  BLOOMSEED_GAME_CONTEXT_REGISTRY_KEY,
  BLOOMSEED_READY_EVENT,
  composeBloomseedGameContext,
} from "../application/gameComposition";
import { registerBloomseedAnimations } from "../assets/animation";
import { preloadBloomseedPack } from "../assets/preload";
import { PRELOAD_SCENE_KEY } from "./BootScene";
import { WORLD_SCENE_KEY } from "./WorldScene";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(PRELOAD_SCENE_KEY);
  }

  public preload(): void {
    preloadBloomseedPack(this);
  }

  public create(): void {
    const animationKeys = registerBloomseedAnimations(this);
    const gameContext = composeBloomseedGameContext(animationKeys);
    this.registry.set(BLOOMSEED_GAME_CONTEXT_REGISTRY_KEY, gameContext);
    this.game.events.emit(BLOOMSEED_READY_EVENT, gameContext);
    this.scene.start(WORLD_SCENE_KEY);
  }
}

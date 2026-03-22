import Phaser from "phaser";
import {
  BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY,
  composeBloomseedBootstrap,
} from "../application/gameComposition";
import {
  RUNTIME_TO_UI_EVENTS,
  emitRuntimeToUiEvent,
} from "../protocol";
import {
  createOfficeSceneBootstrap,
  OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY,
} from "./office/bootstrap";
import { registerPreloadAnimations } from "../assets/animation";
import {
  preloadBloomseedPack,
  preloadDebugPack,
  preloadDonargOfficePack,
} from "../assets/preload";
import { PRELOAD_SCENE_KEY } from "./BootScene";
import { WORLD_SCENE_KEY } from "./WorldScene";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(PRELOAD_SCENE_KEY);
  }

  public preload(): void {
    preloadBloomseedPack(this);
    preloadDebugPack(this);
    preloadDonargOfficePack(this);
  }

  public create(): void {
    const { bloomseedAnimationKeys } = registerPreloadAnimations(this);
    const bootstrap = composeBloomseedBootstrap(bloomseedAnimationKeys);
    this.registry.set(BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY, bootstrap.world);
    this.registry.set(OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY, createOfficeSceneBootstrap());
    emitRuntimeToUiEvent(this.game, RUNTIME_TO_UI_EVENTS.BLOOMSEED_READY, bootstrap.ui);
    this.scene.start(WORLD_SCENE_KEY);
  }
}

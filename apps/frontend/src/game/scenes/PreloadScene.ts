import Phaser from "phaser";
import {
  BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY,
  BLOOMSEED_READY_EVENT,
  composeBloomseedBootstrap,
} from "../application/gameComposition";
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
import { OFFICE_SCENE_KEY } from "./OfficeScene";
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
    this.game.events.emit(BLOOMSEED_READY_EVENT, bootstrap.ui);
    this.scene.start(resolveStartupSceneKey());
  }
}

function resolveStartupSceneKey(): string {
  if (typeof window === "undefined") {
    return WORLD_SCENE_KEY;
  }

  const scene = new URLSearchParams(window.location.search).get("scene");
  return scene === OFFICE_SCENE_KEY ? OFFICE_SCENE_KEY : WORLD_SCENE_KEY;
}

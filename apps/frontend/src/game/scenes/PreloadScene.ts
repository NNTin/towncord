import Phaser from "phaser";
import {
  BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY,
  BLOOMSEED_READY_EVENT,
  composeBloomseedBootstrap,
} from "../application/gameComposition";
import {
  registerBloomseedAnimations,
  registerDonargOfficeAnimations,
} from "../assets/animation";
import {
  preloadBloomseedPack,
  preloadDebugPack,
  preloadDonargOfficePack,
} from "../assets/preload";
import { PRELOAD_SCENE_KEY } from "./BootScene";
import { OFFICE_SCENE_KEY } from "./OfficeScene";
import {
  createOfficeSceneBootstrap,
  OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY,
} from "./office/bootstrap";
import { WORLD_SCENE_KEY } from "./WorldScene";

function resolveInitialSceneKey(search: string = window.location.search): string {
  const params = new URLSearchParams(search);
  return params.get("scene") === "office" ? OFFICE_SCENE_KEY : WORLD_SCENE_KEY;
}

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
    const animationKeys = registerBloomseedAnimations(this);
    registerDonargOfficeAnimations(this);
    const bootstrap = composeBloomseedBootstrap(animationKeys);
    this.registry.set(BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY, bootstrap.world);
    this.registry.set(OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY, createOfficeSceneBootstrap());
    this.game.events.emit(BLOOMSEED_READY_EVENT, bootstrap.ui);
    this.scene.start(resolveInitialSceneKey());
  }
}

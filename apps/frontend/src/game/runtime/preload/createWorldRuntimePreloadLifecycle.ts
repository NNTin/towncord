import type Phaser from "phaser";
import {
  RUNTIME_WORLD_SCENE_KEY,
  type PreloadSceneLifecycleAdapter,
} from "../../../engine/world-runtime/scene";
import {
  UI_BOOTSTRAP_REGISTRY_KEY,
  WORLD_BOOTSTRAP_REGISTRY_KEY,
  composeRuntimeBootstrap,
} from "../../application/runtime-compilation/load-plans/runtimeBootstrap";
import {
  RUNTIME_TO_UI_EVENTS,
  emitRuntimeToUiEvent,
} from "../transport/runtimeEvents";
import {
  createOfficeSceneBootstrap,
  OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY,
} from "../../application/runtime-compilation/structure-surfaces/officeSceneBootstrap";
import { registerPreloadAnimations } from "../../content/preload/animation";
import {
  preloadBloomseedPack,
  preloadDebugPack,
  preloadDonargOfficePack,
  preloadFarmrpgPack,
} from "../../content/preload/preload";

type CreateWorldRuntimePreloadLifecycleOptions = {
  onUiBootstrap?: (
    bootstrap: ReturnType<typeof composeRuntimeBootstrap>["ui"],
  ) => void;
};

/**
 * Creates the game-owned preload lifecycle adapter for the main world runtime.
 *
 * This adapter is the single owner of the main runtime preload-to-bootstrap handoff.
 * It owns:
 * - pack queueing for the main world runtime preload path
 * - preload animation registration
 * - runtime bootstrap composition
 * - world bootstrap registry publication
 * - office bootstrap registry publication
 * - runtime-ready UI event emission
 * - transition to the world runtime scene
 *
 * The engine-owned preload scene shell calls adapter.preload() and adapter.create()
 * from the correct Phaser lifecycle phases.
 */
export function createWorldRuntimePreloadLifecycle(
  options: CreateWorldRuntimePreloadLifecycleOptions = {},
): PreloadSceneLifecycleAdapter {
  return {
    preload(scene: Phaser.Scene): void {
      preloadBloomseedPack(scene);
      preloadDebugPack(scene);
      preloadDonargOfficePack(scene);
      preloadFarmrpgPack(scene);
    },

    create(scene: Phaser.Scene): void {
      const { animationKeys } = registerPreloadAnimations(scene);
      const bootstrap = composeRuntimeBootstrap(animationKeys);
      options.onUiBootstrap?.(bootstrap.ui);
      scene.registry.set(WORLD_BOOTSTRAP_REGISTRY_KEY, bootstrap.world);
      scene.registry.set(UI_BOOTSTRAP_REGISTRY_KEY, bootstrap.ui);
      scene.registry.set(
        OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY,
        createOfficeSceneBootstrap(),
      );

      // Phaser can finish preload/create during Game construction, before the React
      // session wrapper has attached runtimeReady listeners. Deferring the emit by
      // one microtask keeps startup ordering deterministic without changing payloads.
      queueMicrotask(() => {
        emitRuntimeToUiEvent(
          scene.game,
          RUNTIME_TO_UI_EVENTS.RUNTIME_READY,
          bootstrap.ui,
        );
      });

      scene.scene.start(RUNTIME_WORLD_SCENE_KEY);
    },
  };
}

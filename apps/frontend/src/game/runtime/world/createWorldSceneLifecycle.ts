import type Phaser from "phaser";
import type { WorldSceneLifecycleAdapter } from "../../../engine";
import {
  getWorldBootstrap,
  WORLD_BOOTSTRAP_REGISTRY_KEY,
} from "../../application/runtime-compilation/load-plans/runtimeBootstrap";
import {
  createOfficeSceneBootstrap,
  getOfficeSceneBootstrap,
  OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY,
} from "../../application/runtime-compilation/structure-surfaces/officeSceneBootstrap";
import { WorldSceneAssembly } from "./worldSceneAssembly";

/**
 * Creates the game-owned world scene lifecycle adapter.
 *
 * The adapter owns:
 * - bootstrap registry lookup and office bootstrap fallback
 * - WorldSceneAssembly construction and delegation
 * - protocol binding/unbinding (game-layer command listeners)
 * - input and frame delegation to the assembly
 *
 * The engine-owned world scene shell calls the adapter methods in the correct
 * Phaser lifecycle order. This module must not become a second generic scene
 * framework.
 */
export function createWorldSceneLifecycle(): WorldSceneLifecycleAdapter {
  let assembly: WorldSceneAssembly | null = null;

  return {
    boot(scene: Phaser.Scene): void {
      const worldBootstrap = getWorldBootstrap(
        scene.registry.get(WORLD_BOOTSTRAP_REGISTRY_KEY),
      );
      const officeBootstrap =
        getOfficeSceneBootstrap(
          scene.registry.get(OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY),
        ) ?? createOfficeSceneBootstrap();

      assembly = new WorldSceneAssembly(scene);
      assembly.boot(scene, { worldBootstrap, officeBootstrap });
      assembly.protocolBindings.bind();
    },

    update(delta: number): void {
      assembly?.update(delta);
    },

    dispose(): void {
      assembly?.protocolBindings.unbind();
      assembly?.dispose();
      assembly = null;
    },

    onPointerDown(pointer: Phaser.Input.Pointer): void {
      assembly?.inputRouter.onPointerDown(pointer);
    },

    onPointerMove(pointer: Phaser.Input.Pointer): void {
      assembly?.inputRouter.onPointerMove(pointer);
    },

    onPointerUp(pointer: Phaser.Input.Pointer): void {
      assembly?.inputRouter.onPointerUp(pointer);
    },

    onWheel(dy: number, activePointer: Phaser.Input.Pointer): void {
      assembly?.cameraController.handleWheel(dy);
      assembly?.terrainController.syncPreviewFromPointer(activePointer);
    },

    onResize(): void {
      assembly?.cameraController.centerCameraOnWorld();
    },
  };
}

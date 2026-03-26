import Phaser from "phaser";
import type { WorldSceneLifecycleAdapter } from "./contracts";
import { RUNTIME_WORLD_SCENE_KEY } from "./runtimeSceneKeys";

/**
 * Returns an engine-owned Phaser scene constructor for the world runtime.
 *
 * The scene shell owns:
 * - Phaser scene subclassing and scene key registration
 * - pointer, wheel, and resize event binding/unbinding
 * - shutdown cleanup
 * - update loop delegation
 *
 * All game-specific behavior is delegated to the injected adapter.
 * This module must not import WorldSceneAssembly or other game runtime modules.
 */
export function createWorldRuntimeScene(
  adapter: WorldSceneLifecycleAdapter,
): typeof Phaser.Scene {
  class WorldRuntimeScene extends Phaser.Scene {
    constructor() {
      super(RUNTIME_WORLD_SCENE_KEY);
    }

    public create(): void {
      adapter.boot(this);
      this.bindSceneEvents();
      this.scale.once(Phaser.Scale.Events.RESIZE, () => adapter.onResize());
    }

    public override update(_time: number, delta: number): void {
      adapter.update(delta);
    }

    private onPointerDown(pointer: Phaser.Input.Pointer): void {
      adapter.onPointerDown(pointer);
    }

    private onPointerMove(pointer: Phaser.Input.Pointer): void {
      adapter.onPointerMove(pointer);
    }

    private onPointerUp(pointer: Phaser.Input.Pointer): void {
      adapter.onPointerUp(pointer);
    }

    private onWheel(
      _pointer: Phaser.Input.Pointer,
      _gameObjects: unknown,
      _dx: number,
      dy: number,
    ): void {
      adapter.onWheel(dy, this.input.activePointer);
    }

    private bindSceneEvents(): void {
      this.input.on("pointerdown", this.onPointerDown, this);
      this.input.on("pointermove", this.onPointerMove, this);
      this.input.on("pointerup", this.onPointerUp, this);
      this.input.on("pointerupoutside", this.onPointerUp, this);
      this.input.on("wheel", this.onWheel, this);
      this.events.once("shutdown", this.handleShutdown, this);
    }

    private unbindSceneEvents(): void {
      this.input.off("pointerdown", this.onPointerDown, this);
      this.input.off("pointermove", this.onPointerMove, this);
      this.input.off("pointerup", this.onPointerUp, this);
      this.input.off("pointerupoutside", this.onPointerUp, this);
      this.input.off("wheel", this.onWheel, this);
    }

    private handleShutdown(): void {
      this.unbindSceneEvents();
      adapter.dispose();
    }
  }

  return WorldRuntimeScene;
}

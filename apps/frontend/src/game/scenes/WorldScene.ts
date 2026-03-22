import Phaser from "phaser";
import {
  WORLD_BOOTSTRAP_REGISTRY_KEY,
  getWorldBootstrap,
} from "../application/gameComposition";
import {
  createOfficeSceneBootstrap,
  getOfficeSceneBootstrap,
  OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY,
} from "./office/bootstrap";
import { WorldSceneAssembly } from "./world/worldSceneAssembly";

export const WORLD_SCENE_KEY = "world";

export class WorldScene extends Phaser.Scene {
  private readonly assembly: WorldSceneAssembly;

  constructor() {
    super(WORLD_SCENE_KEY);
    this.assembly = new WorldSceneAssembly(this);
  }

  public create(): void {
    const worldBootstrap = getWorldBootstrap(
      this.registry.get(WORLD_BOOTSTRAP_REGISTRY_KEY),
    );
    const officeBootstrap =
      getOfficeSceneBootstrap(
        this.registry.get(OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY),
      ) ?? createOfficeSceneBootstrap();

    this.assembly.boot(this, { worldBootstrap, officeBootstrap });
    this.bindSceneEvents();
    this.scale.once(Phaser.Scale.Events.RESIZE, () =>
      this.assembly.cameraController.centerCameraOnWorld(),
    );
  }

  public override update(_time: number, delta: number): void {
    this.assembly.update(delta);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.assembly.inputRouter.onPointerDown(pointer);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    this.assembly.inputRouter.onPointerMove(pointer);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    this.assembly.inputRouter.onPointerUp(pointer);
  }

  private onWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: unknown,
    _dx: number,
    dy: number,
  ): void {
    this.assembly.cameraController.handleWheel(dy);
    this.assembly.terrainController.syncPreviewFromPointer(this.input.activePointer);
  }

  private bindSceneEvents(): void {
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.input.on("pointerupoutside", this.onPointerUp, this);
    this.input.on("wheel", this.onWheel, this);
    this.assembly.protocolBindings.bind();
    this.events.once("shutdown", this.handleShutdown, this);
  }

  private unbindSceneEvents(): void {
    this.assembly.protocolBindings.unbind();
    this.input.off("pointerdown", this.onPointerDown, this);
    this.input.off("pointermove", this.onPointerMove, this);
    this.input.off("pointerup", this.onPointerUp, this);
    this.input.off("pointerupoutside", this.onPointerUp, this);
    this.input.off("wheel", this.onWheel, this);
  }

  private handleShutdown(): void {
    this.unbindSceneEvents();
    this.assembly.dispose();
  }
}

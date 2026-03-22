import Phaser from "phaser";
import {
  BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY,
  getBloomseedWorldBootstrap,
} from "../application/gameComposition";
import type { AnimationCatalog } from "../assets/animationCatalog";
import type { EntityRegistry } from "../domain/entityRegistry";
import { TerrainSystem } from "../terrain";
import { TownCollisionGrid } from "../town/collisionGrid";
import {
  createOfficeSceneBootstrap,
  getOfficeSceneBootstrap,
  OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY,
} from "./office/bootstrap";
import { WorldSceneInputRouter } from "./world/inputRouter";
import type { MovementInput } from "./world/movementSystem";
import {
  createTerrainNavigationService,
  type WorldNavigationService,
} from "./world/navigation";
import { EntitySystem } from "./world/entitySystem";
import { WorldSceneCameraController } from "./world/worldSceneCameraController";
import { WorldSceneCommandBindings } from "./world/worldSceneCommandBindings";
import { WorldSceneDiagnosticsController } from "./world/worldSceneDiagnosticsController";
import { WorldSceneOfficeRuntime } from "./world/worldSceneOfficeRuntime";
import { WorldScenePlacementController } from "./world/worldScenePlacementController";
import { WorldSceneProjectionEmitter } from "./world/worldSceneProjections";
import { WorldSceneSelectionController } from "./world/worldSceneSelectionController";
import { WorldSceneTerrainController } from "./world/worldSceneTerrainController";

export const WORLD_SCENE_KEY = "world";

type WorldSceneMovementKeys = Record<
  "W" | "A" | "S" | "D",
  Phaser.Input.Keyboard.Key
>;

export class WorldScene extends Phaser.Scene {
  private catalog: AnimationCatalog | null = null;
  private entityRegistry: EntityRegistry | null = null;
  private terrainSystem: TerrainSystem | null = null;
  private navigation: WorldNavigationService | null = null;
  private entitySystem: EntitySystem | null = null;
  private wasd: WorldSceneMovementKeys | null = null;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;

  private readonly projections: WorldSceneProjectionEmitter;
  private readonly cameraController: WorldSceneCameraController;
  private readonly diagnostics: WorldSceneDiagnosticsController;
  private readonly officeRuntime: WorldSceneOfficeRuntime;
  private readonly placementController: WorldScenePlacementController;
  private readonly selectionController: WorldSceneSelectionController;
  private readonly terrainController: WorldSceneTerrainController;
  private readonly protocolBindings: WorldSceneCommandBindings;
  private readonly inputRouter: WorldSceneInputRouter;

  constructor() {
    super(WORLD_SCENE_KEY);

    this.projections = new WorldSceneProjectionEmitter({
      getRuntimeHost: () => this.game,
    });
    this.cameraController = new WorldSceneCameraController(
      {
        getCamera: () => this.cameras.main,
        getTerrainSystem: () => this.terrainSystem,
      },
      this.projections,
    );
    this.diagnostics = new WorldSceneDiagnosticsController(this.projections);
    this.officeRuntime = new WorldSceneOfficeRuntime(
      {
        scene: this,
        getActivePointer: () => this.input.activePointer,
        getWorldPoint: (screenX, screenY) =>
          this.cameras.main.getWorldPoint(screenX, screenY),
      },
      this.projections,
    );
    this.selectionController = new WorldSceneSelectionController(
      {
        scene: this,
        getEntitySystem: () => this.entitySystem,
        getTerrainSystem: () => this.terrainSystem,
      },
      this.projections,
    );
    this.terrainController = new WorldSceneTerrainController({
      scene: this,
      getTerrainSystem: () => this.terrainSystem,
      getEntities: () => this.entitySystem?.getAll() ?? [],
    });
    this.placementController = new WorldScenePlacementController(
      {
        getEntityRegistry: () => this.entityRegistry,
        getTerrainSystem: () => this.terrainSystem,
        getEntitySystem: () => this.entitySystem,
        getWorldPoint: (screenX, screenY) =>
          this.cameras.main.getWorldPoint(screenX, screenY),
        selectEntity: (entity) => this.selectionController.selectEntity(entity),
      },
      this.projections,
    );
    this.protocolBindings = new WorldSceneCommandBindings(
      {
        getRuntimeHost: () => this.game,
      },
      {
        handlePlaceObjectDrop: (payload) =>
          this.placementController.handlePlaceObjectDrop(payload),
        handlePlaceTerrainDrop: (payload) =>
          this.terrainController.handlePlaceTerrainDrop(payload),
        handleSelectTerrainTool: (payload) =>
          this.terrainController.handleSelectTerrainTool(payload),
        handleSetOfficeEditorTool: (payload) =>
          this.officeRuntime.handleSetEditorTool(payload),
        handleSetZoom: (payload) =>
          this.cameraController.handleSetZoom(payload),
      },
    );
    this.inputRouter = new WorldSceneInputRouter({
      beginPan: (pointer) => this.beginPan(pointer),
      tryHandleOfficePointerDown: (pointer) =>
        this.officeRuntime.tryHandlePointerDown(pointer),
      hasActiveTerrainTool: () => this.terrainController.hasActiveTool(),
      beginTerrainPaint: (pointer) => this.beginTerrainPaint(pointer),
      handleSelectionAndInspect: (pointer) =>
        this.selectionController.handleSelectionAndInspect(pointer),
      isPanning: () => this.cameraController.isPanActive(),
      updatePan: (pointer) => this.updatePan(pointer),
      syncHover: (pointer) => this.syncHover(pointer),
      shouldContinueOfficePainting: (pointer) =>
        this.officeRuntime.shouldContinuePainting(pointer),
      continueOfficePainting: (pointer) =>
        this.officeRuntime.continuePainting(pointer),
      shouldContinueTerrainPainting: () =>
        this.terrainController.shouldContinuePainting(),
      continueTerrainPainting: (pointer) =>
        this.terrainController.continuePainting(pointer),
      endPan: (pointer) => this.endPan(pointer),
      endPrimaryPointer: (pointer) => this.endPrimaryPointer(pointer),
    });
  }

  public create(): void {
    const bootstrap = getBloomseedWorldBootstrap(
      this.registry.get(BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY),
    );
    this.catalog = bootstrap?.catalog ?? null;
    this.entityRegistry = bootstrap?.entityRegistry ?? null;

    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as WorldSceneMovementKeys;
    this.shiftKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
    );

    this.terrainSystem = new TerrainSystem(this);
    const officeBootstrap =
      getOfficeSceneBootstrap(
        this.registry.get(OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY),
      ) ?? createOfficeSceneBootstrap();
    const officeRegion = this.officeRuntime.bootstrap(officeBootstrap.layout);
    const collisionGrid = new TownCollisionGrid(
      this.terrainSystem.getGameplayGrid(),
      officeRegion,
    );
    this.navigation = createTerrainNavigationService(
      this.terrainSystem.getGameplayGrid(),
      collisionGrid,
    );

    if (this.catalog) {
      this.entitySystem = new EntitySystem({
        scene: this,
        catalog: this.catalog,
        navigation: this.navigation,
        emitPlayerStateChanged: (payload) =>
          this.projections.emitPlayerStateChanged(payload),
        onSelectedEntityUpdated: (entity) =>
          this.selectionController.syncSelectionBadgePosition(entity),
      });
    }

    this.bindSceneEvents();
    this.selectionController.createSelectionBadge();
    this.terrainController.createBrushPreview();
    this.cameraController.initialize();
    this.scale.once(Phaser.Scale.Events.RESIZE, () =>
      this.cameraController.centerCameraOnWorld(),
    );
  }

  public override update(_time: number, delta: number): void {
    const updateStart = performance.now();

    const terrainStart = performance.now();
    this.terrainSystem?.update();
    const terrainMs = performance.now() - terrainStart;

    if (this.wasd && this.shiftKey && this.entitySystem) {
      this.entitySystem.update(
        delta,
        this.resolveDirectMovementInput(this.wasd, this.shiftKey),
      );
    }

    this.diagnostics.recordFrame(delta, updateStart, terrainMs);
    this.officeRuntime.update();
  }

  private beginPan(pointer: Phaser.Input.Pointer): void {
    this.cameraController.beginPan(pointer);
    this.terrainController.syncPreviewFromPointer(pointer);
  }

  private beginTerrainPaint(pointer: Phaser.Input.Pointer): void {
    this.terrainController.beginPainting(pointer);
  }

  private updatePan(pointer: Phaser.Input.Pointer): void {
    this.cameraController.updatePan(pointer);
    this.terrainController.syncPreviewFromPointer(pointer);
    this.officeRuntime.syncHighlight(pointer);
  }

  private syncHover(pointer: Phaser.Input.Pointer): void {
    this.terrainController.syncPreviewFromPointer(pointer);
    this.officeRuntime.syncHighlight(pointer);
  }

  private endPan(pointer: Phaser.Input.Pointer): void {
    this.cameraController.endPan();
    this.terrainController.syncPreviewFromPointer(pointer);
  }

  private endPrimaryPointer(pointer: Phaser.Input.Pointer): void {
    this.officeRuntime.endPainting();
    this.terrainController.endPainting();
    this.terrainController.syncPreviewFromPointer(pointer);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.inputRouter.onPointerDown(pointer);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    this.inputRouter.onPointerMove(pointer);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    this.inputRouter.onPointerUp(pointer);
  }

  private onWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: unknown,
    _dx: number,
    dy: number,
  ): void {
    this.cameraController.handleWheel(dy);
    this.terrainController.syncPreviewFromPointer(this.input.activePointer);
  }

  private resolveDirectMovementInput(
    wasd: WorldSceneMovementKeys,
    shiftKey: Phaser.Input.Keyboard.Key,
  ): MovementInput {
    return {
      moveX: (wasd.D.isDown ? 1 : 0) - (wasd.A.isDown ? 1 : 0),
      moveY: (wasd.S.isDown ? 1 : 0) - (wasd.W.isDown ? 1 : 0),
      isRunModifier: shiftKey.isDown,
    };
  }

  private bindSceneEvents(): void {
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.input.on("pointerupoutside", this.onPointerUp, this);
    this.input.on("wheel", this.onWheel, this);
    this.protocolBindings.bind();
    this.events.once("shutdown", this.handleShutdown, this);
  }

  private unbindSceneEvents(): void {
    this.protocolBindings.unbind();
    this.input.off("pointerdown", this.onPointerDown, this);
    this.input.off("pointermove", this.onPointerMove, this);
    this.input.off("pointerup", this.onPointerUp, this);
    this.input.off("pointerupoutside", this.onPointerUp, this);
    this.input.off("wheel", this.onWheel, this);
  }

  private handleShutdown(): void {
    this.unbindSceneEvents();
    this.entitySystem?.dispose();
    this.entitySystem = null;
    this.terrainSystem?.destroy();
    this.terrainSystem = null;
    this.officeRuntime.dispose();
    this.selectionController.dispose();
    this.terrainController.dispose();
    this.cameraController.reset();
    this.diagnostics.reset();
    this.catalog = null;
    this.entityRegistry = null;
    this.navigation = null;
    this.wasd = null;
    this.shiftKey = null;
  }
}

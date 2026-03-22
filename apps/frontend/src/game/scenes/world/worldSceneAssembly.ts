import Phaser from "phaser";
import type { EntityRegistry } from "../../domain/entityRegistry";
import { TerrainSystem } from "../../terrain";
import { TownCollisionGrid } from "../../town/collisionGrid";
import type { WorldBootstrap } from "../../application/gameComposition";
import type { OfficeSceneBootstrap } from "../office/bootstrap";
import { EntitySystem } from "./entitySystem";
import { WorldSceneInputRouter } from "./inputRouter";
import type { MovementInput } from "./movementSystem";
import { createTerrainNavigationService, type WorldNavigationService } from "./navigation";
import { WorldSceneCameraController } from "./worldSceneCameraController";
import { WorldSceneCommandBindings } from "./worldSceneCommandBindings";
import { WorldSceneDiagnosticsController } from "./worldSceneDiagnosticsController";
import { WorldSceneOfficeRuntime } from "./worldSceneOfficeRuntime";
import { WorldScenePlacementController } from "./worldScenePlacementController";
import { WorldSceneProjectionEmitter } from "./worldSceneProjections";
import { WorldSceneSelectionController } from "./worldSceneSelectionController";
import { WorldSceneTerrainController } from "./worldSceneTerrainController";

type WorldSceneMovementKeys = Record<
  "W" | "A" | "S" | "D",
  Phaser.Input.Keyboard.Key
>;

export type WorldSceneBootOptions = {
  worldBootstrap: WorldBootstrap | null;
  officeBootstrap: OfficeSceneBootstrap;
};

/**
 * Owns all runtime modules for WorldScene.
 *
 * The assembly creates and wires controllers in its constructor, then boots
 * runtime systems when `boot()` is called during the scene's `create()` phase.
 * WorldScene stays focused on lifecycle orchestration (event binding, update
 * loop, shutdown) while this assembly is where the runtime architecture lives.
 */
export class WorldSceneAssembly {
  public readonly projections: WorldSceneProjectionEmitter;
  public readonly cameraController: WorldSceneCameraController;
  public readonly diagnostics: WorldSceneDiagnosticsController;
  public readonly officeRuntime: WorldSceneOfficeRuntime;
  public readonly selectionController: WorldSceneSelectionController;
  public readonly terrainController: WorldSceneTerrainController;
  public readonly placementController: WorldScenePlacementController;
  public readonly protocolBindings: WorldSceneCommandBindings;
  public readonly inputRouter: WorldSceneInputRouter;

  private terrainSystem: TerrainSystem | null = null;
  private entitySystem: EntitySystem | null = null;
  private entityRegistry: EntityRegistry | null = null;
  private navigation: WorldNavigationService | null = null;
  private wasd: WorldSceneMovementKeys | null = null;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;

  constructor(scene: Phaser.Scene) {
    this.projections = new WorldSceneProjectionEmitter({
      getRuntimeHost: () => scene.game,
    });

    this.cameraController = new WorldSceneCameraController(
      {
        getCamera: () => scene.cameras.main,
        getTerrainSystem: () => this.terrainSystem,
      },
      this.projections,
    );

    this.diagnostics = new WorldSceneDiagnosticsController(this.projections);

    this.officeRuntime = new WorldSceneOfficeRuntime(
      {
        scene,
        getActivePointer: () => scene.input.activePointer,
        getWorldPoint: (screenX, screenY) =>
          scene.cameras.main.getWorldPoint(screenX, screenY),
      },
      this.projections,
    );

    this.selectionController = new WorldSceneSelectionController(
      {
        scene,
        getEntitySystem: () => this.entitySystem,
        getTerrainSystem: () => this.terrainSystem,
      },
      this.projections,
    );

    this.terrainController = new WorldSceneTerrainController({
      scene,
      getTerrainSystem: () => this.terrainSystem,
      getEntities: () => this.entitySystem?.getAll() ?? [],
    });

    this.placementController = new WorldScenePlacementController(
      {
        getEntityRegistry: () => this.entityRegistry,
        getTerrainSystem: () => this.terrainSystem,
        getEntitySystem: () => this.entitySystem,
        getWorldPoint: (screenX, screenY) =>
          scene.cameras.main.getWorldPoint(screenX, screenY),
        selectEntity: (entity) => this.selectionController.selectEntity(entity),
      },
      this.projections,
    );

    this.protocolBindings = new WorldSceneCommandBindings(
      { getRuntimeHost: () => scene.game },
      {
        handlePlaceEntityDrop: (payload) =>
          this.placementController.handlePlaceEntityDrop(payload),
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
      beginPan: (pointer) => {
        this.cameraController.beginPan(pointer);
        this.terrainController.syncPreviewFromPointer(pointer);
      },
      tryHandleOfficePointerDown: (pointer) =>
        this.officeRuntime.tryHandlePointerDown(pointer),
      hasActiveTerrainTool: () => this.terrainController.hasActiveTool(),
      beginTerrainPaint: (pointer) => this.terrainController.beginPainting(pointer),
      handleSelectionAndInspect: (pointer) =>
        this.selectionController.handleSelectionAndInspect(pointer),
      isPanning: () => this.cameraController.isPanActive(),
      updatePan: (pointer) => {
        this.cameraController.updatePan(pointer);
        this.terrainController.syncPreviewFromPointer(pointer);
        this.officeRuntime.syncHighlight(pointer);
      },
      syncHover: (pointer) => {
        this.terrainController.syncPreviewFromPointer(pointer);
        this.officeRuntime.syncHighlight(pointer);
      },
      shouldContinueOfficePainting: (pointer) =>
        this.officeRuntime.shouldContinuePainting(pointer),
      continueOfficePainting: (pointer) =>
        this.officeRuntime.continuePainting(pointer),
      shouldContinueTerrainPainting: () =>
        this.terrainController.shouldContinuePainting(),
      continueTerrainPainting: (pointer) =>
        this.terrainController.continuePainting(pointer),
      endPan: (pointer) => {
        this.cameraController.endPan();
        this.terrainController.syncPreviewFromPointer(pointer);
      },
      endPrimaryPointer: (pointer) => {
        this.officeRuntime.endPainting();
        this.terrainController.endPainting();
        this.terrainController.syncPreviewFromPointer(pointer);
      },
    });
  }

  /**
   * Initializes runtime systems. Call once from the scene's `create()`.
   */
  public boot(scene: Phaser.Scene, options: WorldSceneBootOptions): void {
    const { worldBootstrap, officeBootstrap } = options;

    this.entityRegistry = worldBootstrap?.entityRegistry ?? null;

    this.wasd = scene.input.keyboard!.addKeys("W,A,S,D") as WorldSceneMovementKeys;
    this.shiftKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.terrainSystem = new TerrainSystem(scene);
    const officeRegion = this.officeRuntime.bootstrap(officeBootstrap.layout);
    const collisionGrid = new TownCollisionGrid(
      this.terrainSystem.getGameplayGrid(),
      officeRegion,
    );
    this.navigation = createTerrainNavigationService(
      this.terrainSystem.getGameplayGrid(),
      collisionGrid,
    );

    if (worldBootstrap?.catalog) {
      this.entitySystem = new EntitySystem({
        scene,
        catalog: worldBootstrap.catalog,
        navigation: this.navigation,
        emitPlayerStateChanged: (payload) =>
          this.projections.emitPlayerStateChanged(payload),
        onSelectedEntityUpdated: (entity) =>
          this.selectionController.syncSelectionBadgePosition(entity),
      });
    }

    this.selectionController.createSelectionBadge();
    this.terrainController.createBrushPreview();
    this.cameraController.initialize();
  }

  /**
   * Advances all runtime systems by one frame. Call from the scene's `update()`.
   */
  public update(delta: number): void {
    const updateStart = performance.now();

    const terrainStart = performance.now();
    this.terrainSystem?.update();
    const terrainMs = performance.now() - terrainStart;

    if (this.wasd && this.shiftKey && this.entitySystem) {
      this.entitySystem.update(delta, this.resolveMovementInput(this.wasd, this.shiftKey));
    }

    this.diagnostics.recordFrame(delta, updateStart, terrainMs);
    this.officeRuntime.update();
  }

  /**
   * Tears down all runtime systems. Call from the scene's shutdown handler.
   */
  public dispose(): void {
    this.entitySystem?.dispose();
    this.entitySystem = null;
    this.terrainSystem?.destroy();
    this.terrainSystem = null;
    this.officeRuntime.dispose();
    this.selectionController.dispose();
    this.terrainController.dispose();
    this.cameraController.reset();
    this.diagnostics.reset();
    this.entityRegistry = null;
    this.navigation = null;
    this.wasd = null;
    this.shiftKey = null;
  }

  private resolveMovementInput(
    wasd: WorldSceneMovementKeys,
    shiftKey: Phaser.Input.Keyboard.Key,
  ): MovementInput {
    return {
      moveX: (wasd.D.isDown ? 1 : 0) - (wasd.A.isDown ? 1 : 0),
      moveY: (wasd.S.isDown ? 1 : 0) - (wasd.W.isDown ? 1 : 0),
      isRunModifier: shiftKey.isDown,
    };
  }
}

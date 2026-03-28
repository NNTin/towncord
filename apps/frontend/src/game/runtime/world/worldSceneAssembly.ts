import Phaser from "phaser";
import type { WorldBootstrap } from "../../application/runtime-compilation/load-plans/runtimeBootstrap";
import type { OfficeSceneBootstrap } from "../../contracts/office-scene";
import type { EntityRegistry } from "../../world/entities/entityRegistry";
import {
  TerrainRuntime,
  UnifiedCollisionMap,
  WorldRuntimeCameraController,
  WorldRuntimeDiagnosticsController,
  WorldRuntimeInputRouter,
  createTerrainNavigationService,
  type WorldNavigationService,
} from "../../../engine";
import { createTerrainRuntimeContext } from "../../terrain/runtime";
import { syncFromRuntimeTerrain } from "../../content/document-export";
import { EntitySystem } from "./entitySystem";
import type { MovementInput } from "./movementSystem";
import { WorldSceneCommandBindings } from "./worldSceneCommandBindings";
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
  public readonly cameraController: WorldRuntimeCameraController;
  public readonly diagnostics: WorldRuntimeDiagnosticsController;
  public readonly officeRuntime: WorldSceneOfficeRuntime;
  public readonly selectionController: WorldSceneSelectionController;
  public readonly terrainController: WorldSceneTerrainController;
  public readonly placementController: WorldScenePlacementController;
  public readonly protocolBindings: WorldSceneCommandBindings;
  public readonly inputRouter: WorldRuntimeInputRouter;

  private terrainRuntime: TerrainRuntime | null = null;
  private terrainRuntimeContext:
    | ReturnType<typeof createTerrainRuntimeContext>
    | null = null;
  private entitySystem: EntitySystem | null = null;
  private entityRegistry: EntityRegistry | null = null;
  private navigation: WorldNavigationService | null = null;
  private wasd: WorldSceneMovementKeys | null = null;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;
  private hasEmittedTerrainSeedSnapshot = false;
  private hasPendingTerrainSnapshotChange = false;

  constructor(scene: Phaser.Scene) {
    this.projections = new WorldSceneProjectionEmitter({
      getRuntimeHost: () => scene.game,
    });

    this.cameraController = new WorldRuntimeCameraController(
      {
        getCamera: () => scene.cameras.main,
        getWorldBounds: () =>
          this.terrainRuntime?.getGameplayGrid().getWorldBounds() ?? null,
      },
      {
        onZoomChanged: (payload) => this.projections.emitZoomChanged(payload),
      },
    );

    this.diagnostics = new WorldRuntimeDiagnosticsController({
      onRuntimePerf: (payload) => this.projections.emitRuntimePerf(payload),
    });

    this.officeRuntime = new WorldSceneOfficeRuntime(
      {
        scene,
        getActivePointer: () => scene.input.activePointer,
        getWorldPoint: (screenX, screenY) =>
          scene.cameras.main.getWorldPoint(screenX, screenY),
      },
      this.projections,
    );

    this.terrainRuntimeContext = createTerrainRuntimeContext(scene);

    this.selectionController = new WorldSceneSelectionController(
      {
        scene,
        getEntitySystem: () => this.entitySystem,
        getTerrainRuntime: () => this.terrainRuntime,
      },
      this.projections,
    );

    this.terrainController = new WorldSceneTerrainController({
      scene,
      getTerrainRuntime: () => this.terrainRuntime,
      getEntities: () => this.entitySystem?.getAll() ?? [],
    });

    this.placementController = new WorldScenePlacementController(
      {
        getEntityRegistry: () => this.entityRegistry,
        getTerrainRuntime: () => this.terrainRuntime,
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

    this.inputRouter = new WorldRuntimeInputRouter({
      beginPan: (pointer) => {
        this.cameraController.beginPan(pointer);
        this.terrainController.syncPreviewFromPointer(pointer);
      },
      tryHandleOfficePointerDown: (pointer) =>
        this.officeRuntime.tryHandlePointerDown(pointer),
      hasActiveTerrainTool: () => this.terrainController.hasActiveTool(),
      beginTerrainPaint: (pointer) =>
        this.terrainController.beginPainting(pointer),
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
    const terrainRuntimeContext = this.terrainRuntimeContext;
    if (!terrainRuntimeContext) {
      throw new Error("Terrain runtime context was not initialized.");
    }

    this.entityRegistry = worldBootstrap?.entityRegistry ?? null;

    this.wasd = scene.input.keyboard!.addKeys(
      "W,A,S,D",
    ) as WorldSceneMovementKeys;
    this.shiftKey = scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
    );

    this.terrainRuntime = new TerrainRuntime(
      scene,
      {
        ...terrainRuntimeContext.runtimeOptions,
        onTerrainChanged: () => {
          this.hasPendingTerrainSnapshotChange = true;
        },
      },
    );
    const officeRegion = this.officeRuntime.bootstrap(officeBootstrap);
    const collisionGrid = new UnifiedCollisionMap(
      this.terrainRuntime.getGameplayGrid(),
      {
        ...officeRegion,
        getCellKind: (col, row) =>
          officeRegion.layout.tiles[row * officeRegion.layout.cols + col]
            ?.kind ?? null,
      },
    );
    this.navigation = createTerrainNavigationService(
      this.terrainRuntime.getGameplayGrid(),
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

    if (!this.hasEmittedTerrainSeedSnapshot) {
      this.emitTerrainSeedSnapshot();
      this.hasEmittedTerrainSeedSnapshot = true;
      this.hasPendingTerrainSnapshotChange = false;
    } else if (this.hasPendingTerrainSnapshotChange) {
      this.emitTerrainSeedSnapshot();
      this.hasPendingTerrainSnapshotChange = false;
    }

    const terrainStart = performance.now();
    this.terrainRuntime?.update();
    const terrainMs = performance.now() - terrainStart;

    if (this.wasd && this.shiftKey && this.entitySystem) {
      this.entitySystem.update(
        delta,
        this.resolveMovementInput(this.wasd, this.shiftKey),
      );
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
    this.terrainRuntime?.destroy();
    this.terrainRuntime = null;
    this.officeRuntime.dispose();
    this.selectionController.dispose();
    this.terrainController.dispose();
    this.cameraController.reset();
    this.diagnostics.reset();
    this.entityRegistry = null;
    this.navigation = null;
    this.wasd = null;
    this.shiftKey = null;
    this.terrainRuntimeContext = null;
    this.hasEmittedTerrainSeedSnapshot = false;
    this.hasPendingTerrainSnapshotChange = false;
  }

  private emitTerrainSeedSnapshot(): void {
    const terrainRuntimeContext = this.terrainRuntimeContext;
    if (!terrainRuntimeContext) {
      return;
    }

    this.projections.emitTerrainSeedChanged({
      seed: syncFromRuntimeTerrain(
        terrainRuntimeContext.seedDocument,
        terrainRuntimeContext.runtimeOptions.store,
      ),
    });
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

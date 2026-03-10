import Phaser from "phaser";
import {
  BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY,
  getBloomseedWorldBootstrap,
  type BloomseedWorldBootstrap,
} from "../application/gameComposition";
import { mapDropPayloadToSpawnRequest } from "../application/spawnRequestMapper";
import type { AnimationCatalog } from "../assets/animationCatalog";
import {
  PLACE_OBJECT_DROP_EVENT,
  PLACE_TERRAIN_DROP_EVENT,
  PLAYER_PLACED_EVENT,
  PLAYER_STATE_CHANGED_EVENT,
  RUNTIME_PERF_EVENT,
  SELECT_TERRAIN_TOOL_EVENT,
  TERRAIN_TILE_INSPECTED_EVENT,
  type PlaceObjectDropPayload,
  type PlaceTerrainDropPayload,
  type PlayerPlacedPayload,
  type PlayerStateChangedPayload,
  type RuntimePerfPayload,
  type SelectedTerrainToolPayload,
  type TerrainTileInspectedPayload,
} from "../events";
import {
  TERRAIN_CELL_WORLD_SIZE,
  TERRAIN_RENDER_GRID_WORLD_OFFSET,
  TERRAIN_TEXTURE_KEY,
  TerrainSystem,
  type TerrainCellCoord,
  type TerrainRenderTile,
} from "../terrain";
import { playEntityAnimation } from "./world/animationSystem";
import {
  AUTONOMY_IDLE_DELAY_MS,
  resetEntityAutonomy,
  updateEntityAutonomy,
} from "./world/autonomySystem";
import { createWorldEntity } from "./world/entityFactory";
import { createTerrainNavigationService, type WorldNavigationService } from "./world/navigation";
import { TerrainPaintSession } from "./world/terrainPaintSession";
import { updateEntityMovement, type MovementInput } from "./world/movementSystem";
import type { WorldEntity, WorldPoint } from "./world/types";

export const WORLD_SCENE_KEY = "world";

const SPRITE_SCALE = 4;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const SELECTED_BADGE_ANIMATION_KEY = "props.bloomseed.static.rocks.variant-03";
const SELECTED_BADGE_SCALE = 2;
const SELECTED_BADGE_VERTICAL_OFFSET = 12;
const TERRAIN_BRUSH_PREVIEW_DEPTH = 9_000;
const TERRAIN_BRUSH_PREVIEW_ALPHA = 0.18;
const TERRAIN_BRUSH_PREVIEW_STROKE_WIDTH = 2;
const TERRAIN_BRUSH_PREVIEW_READY_FILL = 0x38bdf8;
const TERRAIN_BRUSH_PREVIEW_READY_STROKE = 0xe0f2fe;
const TERRAIN_BRUSH_PREVIEW_BLOCKED_FILL = 0xef4444;
const TERRAIN_BRUSH_PREVIEW_BLOCKED_STROKE = 0xfecaca;
const TERRAIN_BRUSH_RENDER_PREVIEW_ALPHA = 0.72;

export class WorldScene extends Phaser.Scene {
  private catalog: AnimationCatalog | null = null;
  private entityRegistry: BloomseedWorldBootstrap["entityRegistry"] | null = null;

  private entities: WorldEntity[] = [];
  private selectedEntity: WorldEntity | null = null;
  private selectionBadge: Phaser.GameObjects.Sprite | null = null;
  private terrainBrushPreview: Phaser.GameObjects.Rectangle | null = null;
  private readonly terrainBrushRenderPreviewImages: Phaser.GameObjects.Image[] = [];
  private terrainSystem: TerrainSystem | null = null;
  private navigation: WorldNavigationService | null = null;
  private nextId = 0;

  private wasd: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key> | null = null;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;
  private activeTerrainTool: SelectedTerrainToolPayload = null;
  private readonly terrainPaintSession = new TerrainPaintSession();

  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private camStartX = 0;
  private camStartY = 0;
  private lastPerfEmitAtMs = 0;
  private directInputIdleMs = 0;

  constructor() {
    super(WORLD_SCENE_KEY);
  }

  public create(): void {
    const bootstrap = getBloomseedWorldBootstrap(
      this.registry.get(BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY),
    );
    if (bootstrap) {
      this.catalog = bootstrap.catalog;
      this.entityRegistry = bootstrap.entityRegistry;
    }

    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as Record<
      "W" | "A" | "S" | "D",
      Phaser.Input.Keyboard.Key
    >;
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.input.on("pointerupoutside", this.onPointerUp, this);
    this.input.on("wheel", this.onWheel, this);

    this.terrainSystem = new TerrainSystem(this);
    this.navigation = createTerrainNavigationService(this.terrainSystem.getGameplayGrid());
    this.game.events.on(PLACE_OBJECT_DROP_EVENT, this.onPlaceObjectDrop, this);
    this.game.events.on(PLACE_TERRAIN_DROP_EVENT, this.onPlaceTerrainDrop, this);
    this.game.events.on(SELECT_TERRAIN_TOOL_EVENT, this.onSelectTerrainTool, this);
    this.events.once(
      "shutdown",
      () => {
        this.terrainSystem?.destroy();
        this.terrainSystem = null;
        this.navigation = null;
        this.selectionBadge?.destroy();
        this.selectionBadge = null;
        this.terrainBrushPreview?.destroy();
        this.terrainBrushPreview = null;
        for (const image of this.terrainBrushRenderPreviewImages) {
          image.destroy();
        }
        this.terrainBrushRenderPreviewImages.length = 0;
        this.game.events.off(PLACE_OBJECT_DROP_EVENT, this.onPlaceObjectDrop, this);
        this.game.events.off(PLACE_TERRAIN_DROP_EVENT, this.onPlaceTerrainDrop, this);
        this.game.events.off(SELECT_TERRAIN_TOOL_EVENT, this.onSelectTerrainTool, this);
        this.input.off("pointerdown", this.onPointerDown, this);
        this.input.off("pointermove", this.onPointerMove, this);
        this.input.off("pointerup", this.onPointerUp, this);
        this.input.off("pointerupoutside", this.onPointerUp, this);
        this.input.off("wheel", this.onWheel, this);
      },
      this,
    );

    this.createSelectionBadge();
    this.createTerrainBrushPreview();
  }

  public override update(_time: number, delta: number): void {
    const updateStart = performance.now();

    const terrainStart = performance.now();
    this.terrainSystem?.update();
    const terrainMs = performance.now() - terrainStart;

    if (this.wasd && this.shiftKey && this.catalog && this.navigation) {
      const dt = delta / 1000;
      const directInput = this.resolveDirectMovementInput();
      const hasDirectMovement = directInput.moveX !== 0 || directInput.moveY !== 0;
      this.directInputIdleMs = hasDirectMovement ? 0 : this.directInputIdleMs + delta;
      const autoplayEnabled = this.directInputIdleMs >= AUTONOMY_IDLE_DELAY_MS;

      for (const entity of this.entities) {
        const prevState = entity.state;
        const prevFacing = entity.facing;
        const prevAnimationAction = entity.animationAction;
        const isSelected = entity === this.selectedEntity;

        const movementInput =
          isSelected && hasDirectMovement
            ? directInput
            : updateEntityAutonomy(entity, delta, {
                autoplayEnabled,
                navigation: this.navigation,
              });

        if (isSelected && hasDirectMovement) {
          resetEntityAutonomy(entity);
        }

        updateEntityMovement(entity, dt, movementInput);
        if (!entity.autonomy.currentAmbientAction) {
          entity.animationAction = entity.state;
        }

        const nextPosition = {
          x: entity.position.x + entity.velocity.x * dt,
          y: entity.position.y + entity.velocity.y * dt,
        };
        const resolvedPosition = this.resolveEntityPosition(entity.position, nextPosition);
        entity.position.x = resolvedPosition.x;
        entity.position.y = resolvedPosition.y;
        if (resolvedPosition.x !== nextPosition.x) {
          entity.velocity.x = 0;
        }
        if (resolvedPosition.y !== nextPosition.y) {
          entity.velocity.y = 0;
        }
        entity.sprite.setPosition(entity.position.x, entity.position.y);
        if (entity.velocity.x === 0 && entity.velocity.y === 0 && entity.state !== "idle") {
          entity.state = "idle";
          if (!entity.autonomy.currentAmbientAction) {
            entity.animationAction = entity.state;
          }
        }

        const stateChanged = entity.state !== prevState;
        const dirChanged = entity.state !== "idle" && entity.facing !== prevFacing;
        const animationChanged = entity.animationAction !== prevAnimationAction;
        if (stateChanged || dirChanged || animationChanged) {
          playEntityAnimation(entity, this.catalog);
          if (isSelected && stateChanged && entity.definition.kind === "player") {
            const payload: PlayerStateChangedPayload = { state: entity.state };
            this.game.events.emit(PLAYER_STATE_CHANGED_EVENT, payload);
          }
        }

        if (isSelected) {
          this.syncSelectionBadgePosition(entity);
        }
      }
    }

    const now = performance.now();
    if (now - this.lastPerfEmitAtMs >= 100) {
      const updateMs = now - updateStart;
      const fps = delta > 0 ? 1000 / delta : 0;
      const payload: RuntimePerfPayload = {
        timestampMs: now,
        fps,
        frameMs: delta,
        updateMs,
        terrainMs,
      };
      this.game.events.emit(RUNTIME_PERF_EVENT, payload);
      this.lastPerfEmitAtMs = now;
    }
  }

  private selectEntity(entity: WorldEntity | null): void {
    if (this.selectedEntity === entity) return;
    this.selectedEntity = entity;
    this.setSelectionBadgeVisible(Boolean(entity));
    if (entity) this.syncSelectionBadgePosition(entity);
  }

  private createSelectionBadge(): void {
    const firstFrame = this.anims.get(SELECTED_BADGE_ANIMATION_KEY)?.frames[0];
    if (!firstFrame) return;

    const badge = this.add.sprite(0, 0, firstFrame.textureKey, firstFrame.textureFrame);
    badge.setScale(SELECTED_BADGE_SCALE);
    badge.setDepth(10_000);
    badge.setVisible(false);
    this.selectionBadge = badge;
  }

  private createTerrainBrushPreview(): void {
    const preview = this.add.rectangle(
      0,
      0,
      TERRAIN_CELL_WORLD_SIZE,
      TERRAIN_CELL_WORLD_SIZE,
      TERRAIN_BRUSH_PREVIEW_READY_FILL,
      TERRAIN_BRUSH_PREVIEW_ALPHA,
    );
    preview.setOrigin(0, 0);
    preview.setDepth(TERRAIN_BRUSH_PREVIEW_DEPTH);
    preview.setStrokeStyle(
      TERRAIN_BRUSH_PREVIEW_STROKE_WIDTH,
      TERRAIN_BRUSH_PREVIEW_READY_STROKE,
      0.9,
    );
    preview.setVisible(false);
    this.terrainBrushPreview = preview;
  }

  private setSelectionBadgeVisible(visible: boolean): void {
    if (!this.selectionBadge) return;
    this.selectionBadge.setVisible(visible);
  }

  private setTerrainBrushPreviewVisible(visible: boolean): void {
    if (!this.terrainBrushPreview) return;
    this.terrainBrushPreview.setVisible(visible);
  }

  private hideTerrainBrushRenderPreview(): void {
    for (const image of this.terrainBrushRenderPreviewImages) {
      image.setVisible(false);
    }
  }

  private getTerrainBrushRenderPreviewImage(index: number): Phaser.GameObjects.Image {
    const existing = this.terrainBrushRenderPreviewImages[index];
    if (existing) {
      return existing;
    }

    const image = this.add.image(0, 0, TERRAIN_TEXTURE_KEY);
    image.setAlpha(TERRAIN_BRUSH_RENDER_PREVIEW_ALPHA);
    image.setDepth(TERRAIN_BRUSH_PREVIEW_DEPTH - 1);
    image.setVisible(false);
    this.terrainBrushRenderPreviewImages[index] = image;
    return image;
  }

  private syncTerrainBrushRenderPreviewTiles(tiles: readonly TerrainRenderTile[]): void {
    tiles.forEach((tile, index) => {
      const image = this.getTerrainBrushRenderPreviewImage(index);
      image.setTexture(TERRAIN_TEXTURE_KEY, tile.frame);
      image.setScale(TERRAIN_CELL_WORLD_SIZE / image.width);
      image.setRotation(tile.rotate90 * (Math.PI / 2));
      image.setFlip(tile.flipX, tile.flipY);
      image.setPosition(
        tile.cellX * TERRAIN_CELL_WORLD_SIZE + TERRAIN_CELL_WORLD_SIZE * 0.5 + TERRAIN_RENDER_GRID_WORLD_OFFSET,
        tile.cellY * TERRAIN_CELL_WORLD_SIZE + TERRAIN_CELL_WORLD_SIZE * 0.5 + TERRAIN_RENDER_GRID_WORLD_OFFSET,
      );
      image.setVisible(true);
    });

    for (let index = tiles.length; index < this.terrainBrushRenderPreviewImages.length; index += 1) {
      this.terrainBrushRenderPreviewImages[index]?.setVisible(false);
    }
  }

  private syncSelectionBadgePosition(entity: WorldEntity): void {
    if (!this.selectionBadge) return;
    this.selectionBadge.setPosition(
      entity.position.x,
      entity.position.y - entity.sprite.displayHeight * 0.5 - SELECTED_BADGE_VERTICAL_OFFSET,
    );
  }

  private onPlaceObjectDrop(payload: PlaceObjectDropPayload): void {
    if (!this.catalog || !this.entityRegistry || !this.terrainSystem) return;

    const spawnRequest = mapDropPayloadToSpawnRequest(payload);
    const runtime = this.entityRegistry.getRuntimeById(spawnRequest.entityId);
    if (!runtime || !runtime.definition.placeable) return;
    const { definition } = runtime;

    const worldPoint = this.cameras.main.getWorldPoint(spawnRequest.screenX, spawnRequest.screenY);
    const clamped = this.terrainSystem.getGameplayGrid().clampWorldPoint(worldPoint.x, worldPoint.y);
    if (!this.terrainSystem.getGameplayGrid().isWorldWalkable(clamped.worldX, clamped.worldY)) {
      return;
    }

    const entity = createWorldEntity({
      scene: this,
      catalog: this.catalog,
      runtime,
      nextId: this.nextId,
      worldX: clamped.worldX,
      worldY: clamped.worldY,
      spriteScale: SPRITE_SCALE,
    });
    if (!entity) return;

    this.nextId += 1;
    this.entities.push(entity);
    this.selectEntity(entity);

    if (definition.kind === "player") {
      const placedPayload: PlayerPlacedPayload = { worldX: clamped.worldX, worldY: clamped.worldY };
      this.game.events.emit(PLAYER_PLACED_EVENT, placedPayload);
    }
  }

  private onPlaceTerrainDrop(payload: PlaceTerrainDropPayload): void {
    if (!this.terrainSystem) return;
    const worldPoint = this.cameras.main.getWorldPoint(payload.screenX, payload.screenY);
    this.queueTerrainDropAtWorld(payload, worldPoint.x, worldPoint.y);
  }

  private onSelectTerrainTool(payload: SelectedTerrainToolPayload): void {
    this.activeTerrainTool = payload;
    this.terrainPaintSession.end();
    this.syncTerrainBrushPreviewFromPointer(this.input.activePointer);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 1) {
      this.isPanning = true;
      this.panStartX = pointer.x;
      this.panStartY = pointer.y;
      this.camStartX = this.cameras.main.scrollX;
      this.camStartY = this.cameras.main.scrollY;
      this.syncTerrainBrushPreviewFromPointer(pointer);
    } else if (pointer.button === 0) {
      if (this.activeTerrainTool) {
        this.terrainPaintSession.begin();
        this.syncTerrainBrushPreviewFromPointer(pointer);
        this.paintTerrainAtScreen(pointer.x, pointer.y);
        return;
      }

      let hit: WorldEntity | null = null;
      const hits = this.input.sortGameObjects(this.input.hitTestPointer(pointer), pointer);

      for (const target of hits) {
        const entity = this.entities.find((candidate) => candidate.sprite === target);
        if (entity) {
          hit = entity;
          break;
        }
      }

      this.selectEntity(hit);

      if (this.terrainSystem) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const inspected = this.terrainSystem.inspectAtWorld(worldPoint.x, worldPoint.y);
        if (inspected) {
          const payload: TerrainTileInspectedPayload = inspected;
          this.game.events.emit(TERRAIN_TILE_INSPECTED_EVENT, payload);
        }
      }
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.isPanning) {
      const zoom = this.cameras.main.zoom;
      const dx = (pointer.x - this.panStartX) / zoom;
      const dy = (pointer.y - this.panStartY) / zoom;
      this.cameras.main.setScroll(this.camStartX - dx, this.camStartY - dy);
      this.syncTerrainBrushPreviewFromPointer(pointer);
      return;
    }

    this.syncTerrainBrushPreviewFromPointer(pointer);
    if (!this.activeTerrainTool) return;
    if (!this.terrainPaintSession.isActive()) return;
    this.paintTerrainAtScreen(pointer.x, pointer.y);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 1) {
      this.isPanning = false;
      this.syncTerrainBrushPreviewFromPointer(pointer);
    } else if (pointer.button === 0) {
      this.terrainPaintSession.end();
      this.syncTerrainBrushPreviewFromPointer(pointer);
    }
  }

  private onWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: unknown,
    _dx: number,
    dy: number,
  ): void {
    const cam = this.cameras.main;
    const factor = dy > 0 ? 0.9 : 1.1;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM));
    this.syncTerrainBrushPreviewFromPointer(this.input.activePointer);
  }

  private syncTerrainBrushPreviewFromPointer(pointer: Phaser.Input.Pointer | null): void {
    if (!pointer) {
      this.setTerrainBrushPreviewVisible(false);
      this.hideTerrainBrushRenderPreview();
      return;
    }

    const isWithinGame =
      !("withinGame" in pointer) ||
      Boolean((pointer as Phaser.Input.Pointer & { withinGame?: boolean }).withinGame);

    if (!isWithinGame) {
      this.setTerrainBrushPreviewVisible(false);
      this.hideTerrainBrushRenderPreview();
      return;
    }

    this.syncTerrainBrushPreviewAtScreen(pointer.x, pointer.y);
  }

  private paintTerrainAtScreen(screenX: number, screenY: number): void {
    if (!this.activeTerrainTool || !this.terrainSystem) return;

    const worldPoint = this.cameras.main.getWorldPoint(screenX, screenY);
    const cell = this.terrainSystem.getGameplayGrid().worldToCell(worldPoint.x, worldPoint.y);
    if (!cell || this.isTerrainCellOccupied(cell) || !this.terrainPaintSession.shouldPaintCell(cell)) {
      return;
    }

    this.queueTerrainDropAtWorld(
      {
        type: "terrain",
        materialId: this.activeTerrainTool.materialId,
        brushId: this.activeTerrainTool.brushId,
        screenX,
        screenY,
      },
      worldPoint.x,
      worldPoint.y,
    );
  }

  private syncTerrainBrushPreviewAtScreen(screenX: number, screenY: number): void {
    if (!this.activeTerrainTool || !this.terrainSystem || !this.terrainBrushPreview) {
      this.setTerrainBrushPreviewVisible(false);
      this.hideTerrainBrushRenderPreview();
      return;
    }

    const worldPoint = this.cameras.main.getWorldPoint(screenX, screenY);
    const grid = this.terrainSystem.getGameplayGrid();
    const cell = grid.worldToCell(worldPoint.x, worldPoint.y);
    if (!cell) {
      this.setTerrainBrushPreviewVisible(false);
      this.hideTerrainBrushRenderPreview();
      return;
    }

    const isBlocked = this.isTerrainCellOccupied(cell);
    this.terrainBrushPreview.setFillStyle(
      isBlocked ? TERRAIN_BRUSH_PREVIEW_BLOCKED_FILL : TERRAIN_BRUSH_PREVIEW_READY_FILL,
      TERRAIN_BRUSH_PREVIEW_ALPHA,
    );
    this.terrainBrushPreview.setStrokeStyle(
      TERRAIN_BRUSH_PREVIEW_STROKE_WIDTH,
      isBlocked ? TERRAIN_BRUSH_PREVIEW_BLOCKED_STROKE : TERRAIN_BRUSH_PREVIEW_READY_STROKE,
      0.9,
    );
    // Terrain edits target the placement grid anchor; render tiles are resolved on the dual grid.
    this.terrainBrushPreview.setPosition(
      cell.cellX * TERRAIN_CELL_WORLD_SIZE,
      cell.cellY * TERRAIN_CELL_WORLD_SIZE,
    );
    this.terrainBrushPreview.setVisible(true);

    if (isBlocked) {
      this.hideTerrainBrushRenderPreview();
      return;
    }

    const previewTiles = this.terrainSystem.previewPaintAtWorld(
      {
        type: "terrain",
        materialId: this.activeTerrainTool.materialId,
        brushId: this.activeTerrainTool.brushId,
        screenX,
        screenY,
      },
      worldPoint.x,
      worldPoint.y,
    );
    if (!previewTiles || previewTiles.length === 0) {
      this.hideTerrainBrushRenderPreview();
      return;
    }

    this.syncTerrainBrushRenderPreviewTiles(previewTiles);
  }

  private queueTerrainDropAtWorld(
    payload: PlaceTerrainDropPayload,
    worldX: number,
    worldY: number,
  ): void {
    if (!this.terrainSystem) return;

    const cell = this.terrainSystem.getGameplayGrid().worldToCell(worldX, worldY);
    if (!cell || this.isTerrainCellOccupied(cell)) return;

    this.terrainSystem.queueDrop(payload, worldX, worldY);
  }

  private isTerrainCellOccupied(cell: TerrainCellCoord): boolean {
    if (!this.terrainSystem) return false;

    const grid = this.terrainSystem.getGameplayGrid();
    return this.entities.some((entity) => {
      const entityCell = grid.worldToCell(entity.position.x, entity.position.y);
      return entityCell?.cellX === cell.cellX && entityCell?.cellY === cell.cellY;
    });
  }

  private resolveDirectMovementInput(): MovementInput {
    if (!this.wasd || !this.shiftKey) {
      return {
        moveX: 0,
        moveY: 0,
        isRunModifier: false,
      };
    }

    return {
      moveX: (this.wasd.D.isDown ? 1 : 0) - (this.wasd.A.isDown ? 1 : 0),
      moveY: (this.wasd.S.isDown ? 1 : 0) - (this.wasd.W.isDown ? 1 : 0),
      isRunModifier: this.shiftKey.isDown,
    };
  }

  private resolveEntityPosition(current: WorldPoint, next: WorldPoint): WorldPoint {
    if (!this.navigation) return next;

    const clampedNext = this.navigation.clampToBounds(next);
    if (this.navigation.isWalkable(clampedNext)) {
      return clampedNext;
    }

    const xOnly = this.navigation.clampToBounds({ x: clampedNext.x, y: current.y });
    if (this.navigation.isWalkable(xOnly)) {
      return xOnly;
    }

    const yOnly = this.navigation.clampToBounds({ x: current.x, y: clampedNext.y });
    if (this.navigation.isWalkable(yOnly)) {
      return yOnly;
    }

    return current;
  }
}

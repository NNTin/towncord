import Phaser from "phaser";
import {
  BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY,
  getBloomseedWorldBootstrap,
} from "../application/gameComposition";
import { mapDropPayloadToSpawnRequest } from "../application/spawnRequestMapper";
import type { AnimationCatalog } from "../assets/animationCatalog";
import type { EntityRegistry } from "../domain/entityRegistry";
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
  ZOOM_CHANGED_EVENT,
  SET_ZOOM_EVENT,
  type SetZoomPayload,
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
import { createWorldEntity, WORLD_ENTITY_SPRITE_ORIGIN_Y } from "./world/entityFactory";
import { createTerrainNavigationService, type WorldNavigationService } from "./world/navigation";
import { WorldSceneRuntime, type WorldSceneMovementKeys } from "./world/sceneRuntime";
import { TerrainPaintSession } from "./world/terrainPaintSession";
import { updateEntityMovement, type MovementInput } from "./world/movementSystem";
import type { WorldEntity, WorldPoint, WorldSelectableActor } from "./world/types";

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
  private readonly runtimeState = new WorldSceneRuntime();

  private get catalog(): AnimationCatalog | null {
    return this.runtimeState.catalog;
  }

  private set catalog(value: AnimationCatalog | null) {
    this.runtimeState.catalog = value;
  }

  private get entityRegistry(): EntityRegistry | null {
    return this.runtimeState.entityRegistry;
  }

  private set entityRegistry(value: EntityRegistry | null) {
    this.runtimeState.entityRegistry = value;
  }

  private get entities(): WorldEntity[] {
    return this.runtimeState.entities;
  }

  private set entities(value: WorldEntity[]) {
    this.runtimeState.entities = value;
  }

  private get selectedEntity(): WorldEntity | null {
    return this.runtimeState.selectedEntity;
  }

  private set selectedEntity(value: WorldEntity | null) {
    this.runtimeState.selectedEntity = value;
  }

  private get selectionBadge(): Phaser.GameObjects.Sprite | null {
    return this.runtimeState.selectionBadge;
  }

  private set selectionBadge(value: Phaser.GameObjects.Sprite | null) {
    this.runtimeState.selectionBadge = value;
  }

  private get terrainBrushPreview(): Phaser.GameObjects.Rectangle | null {
    return this.runtimeState.terrainBrushPreview;
  }

  private set terrainBrushPreview(value: Phaser.GameObjects.Rectangle | null) {
    this.runtimeState.terrainBrushPreview = value;
  }

  private get terrainBrushRenderPreviewImages(): Phaser.GameObjects.Image[] {
    return this.runtimeState.terrainBrushRenderPreviewImages;
  }

  private set terrainBrushRenderPreviewImages(value: Phaser.GameObjects.Image[]) {
    this.runtimeState.terrainBrushRenderPreviewImages = value;
  }

  private get terrainSystem(): TerrainSystem | null {
    return this.runtimeState.terrainSystem;
  }

  private set terrainSystem(value: TerrainSystem | null) {
    this.runtimeState.terrainSystem = value;
  }

  private get navigation(): WorldNavigationService | null {
    return this.runtimeState.navigation;
  }

  private set navigation(value: WorldNavigationService | null) {
    this.runtimeState.navigation = value;
  }

  private get nextId(): number {
    return this.runtimeState.nextId;
  }

  private set nextId(value: number) {
    this.runtimeState.nextId = value;
  }

  private get wasd(): WorldSceneMovementKeys | null {
    return this.runtimeState.wasd;
  }

  private set wasd(value: WorldSceneMovementKeys | null) {
    this.runtimeState.wasd = value;
  }

  private get shiftKey(): Phaser.Input.Keyboard.Key | null {
    return this.runtimeState.shiftKey;
  }

  private set shiftKey(value: Phaser.Input.Keyboard.Key | null) {
    this.runtimeState.shiftKey = value;
  }

  private get activeTerrainTool(): SelectedTerrainToolPayload {
    return this.runtimeState.activeTerrainTool;
  }

  private set activeTerrainTool(value: SelectedTerrainToolPayload) {
    this.runtimeState.activeTerrainTool = value;
  }

  private get terrainPaintSession(): TerrainPaintSession {
    return this.runtimeState.terrainPaintSession;
  }

  private set terrainPaintSession(value: TerrainPaintSession) {
    this.runtimeState.terrainPaintSession = value;
  }

  private get isPanning(): boolean {
    return this.runtimeState.isPanning;
  }

  private set isPanning(value: boolean) {
    this.runtimeState.isPanning = value;
  }

  private get panStartX(): number {
    return this.runtimeState.panStartX;
  }

  private set panStartX(value: number) {
    this.runtimeState.panStartX = value;
  }

  private get panStartY(): number {
    return this.runtimeState.panStartY;
  }

  private set panStartY(value: number) {
    this.runtimeState.panStartY = value;
  }

  private get camStartX(): number {
    return this.runtimeState.camStartX;
  }

  private set camStartX(value: number) {
    this.runtimeState.camStartX = value;
  }

  private get camStartY(): number {
    return this.runtimeState.camStartY;
  }

  private set camStartY(value: number) {
    this.runtimeState.camStartY = value;
  }

  private get lastPerfEmitAtMs(): number {
    return this.runtimeState.lastPerfEmitAtMs;
  }

  private set lastPerfEmitAtMs(value: number) {
    this.runtimeState.lastPerfEmitAtMs = value;
  }

  private get directInputIdleMs(): number {
    return this.runtimeState.directInputIdleMs;
  }

  private set directInputIdleMs(value: number) {
    this.runtimeState.directInputIdleMs = value;
  }

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

    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as WorldSceneMovementKeys;
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.terrainSystem = new TerrainSystem(this);
    this.navigation = createTerrainNavigationService(this.terrainSystem.getGameplayGrid());
    this.bindSceneEvents();

    this.createSelectionBadge();
    this.createTerrainBrushPreview();

    this.game.events.emit(ZOOM_CHANGED_EVENT, {
      zoom: this.cameras.main.zoom,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
  }

  public override update(_time: number, delta: number): void {
    const runtimeState = this.runtimeState;
    const updateStart = performance.now();

    const terrainSystem = runtimeState.terrainSystem;
    const terrainStart = performance.now();
    terrainSystem?.update();
    const terrainMs = performance.now() - terrainStart;

    const { catalog, navigation, shiftKey, wasd } = runtimeState;
    if (wasd && shiftKey && catalog && navigation) {
      const dt = delta / 1000;
      const directInput = this.resolveDirectMovementInput(wasd, shiftKey);
      const hasDirectMovement = directInput.moveX !== 0 || directInput.moveY !== 0;
      const directInputIdleMs = hasDirectMovement ? 0 : runtimeState.directInputIdleMs + delta;
      runtimeState.directInputIdleMs = directInputIdleMs;
      const autoplayEnabled = directInputIdleMs >= AUTONOMY_IDLE_DELAY_MS;
      const entities = runtimeState.entities;
      const selectedEntity = runtimeState.selectedEntity;

      for (const entity of entities) {
        const prevState = entity.state;
        const prevFacing = entity.facing;
        const prevAnimationAction = entity.animationAction;
        const isSelected = entity === selectedEntity;

        const movementInput =
          isSelected && hasDirectMovement
            ? directInput
            : updateEntityAutonomy(entity, delta, {
                autoplayEnabled,
                navigation,
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
        const resolvedPosition = this.resolveEntityPosition(entity.position, nextPosition, navigation);
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
          playEntityAnimation(entity, catalog);
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
    if (now - runtimeState.lastPerfEmitAtMs >= 100) {
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
      runtimeState.lastPerfEmitAtMs = now;
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

  private syncSelectionBadgePosition(entity: WorldSelectableActor): void {
    if (!this.selectionBadge) return;
    this.selectionBadge.setPosition(
      entity.position.x,
      entity.position.y -
        entity.sprite.displayHeight * WORLD_ENTITY_SPRITE_ORIGIN_Y -
        SELECTED_BADGE_VERTICAL_OFFSET,
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
    this.game.events.emit(ZOOM_CHANGED_EVENT, {
      zoom: cam.zoom,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
    this.syncTerrainBrushPreviewFromPointer(this.input.activePointer);
  }

  private onSetZoom(payload: SetZoomPayload): void {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(payload.zoom, MIN_ZOOM, MAX_ZOOM));
    this.game.events.emit(ZOOM_CHANGED_EVENT, {
      zoom: cam.zoom,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
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

  private resolveDirectMovementInput(
    wasd: WorldSceneMovementKeys | null = this.wasd,
    shiftKey: Phaser.Input.Keyboard.Key | null = this.shiftKey,
  ): MovementInput {
    if (!wasd || !shiftKey) {
      return {
        moveX: 0,
        moveY: 0,
        isRunModifier: false,
      };
    }

    return {
      moveX: (wasd.D.isDown ? 1 : 0) - (wasd.A.isDown ? 1 : 0),
      moveY: (wasd.S.isDown ? 1 : 0) - (wasd.W.isDown ? 1 : 0),
      isRunModifier: shiftKey.isDown,
    };
  }

  private resolveEntityPosition(
    current: WorldPoint,
    next: WorldPoint,
    navigation: WorldNavigationService | null = this.navigation,
  ): WorldPoint {
    if (!navigation) return next;

    const clampedNext = navigation.clampToBounds(next);
    if (navigation.isWalkable(clampedNext)) {
      return clampedNext;
    }

    const xOnly = navigation.clampToBounds({ x: clampedNext.x, y: current.y });
    if (navigation.isWalkable(xOnly)) {
      return xOnly;
    }

    const yOnly = navigation.clampToBounds({ x: current.x, y: clampedNext.y });
    if (navigation.isWalkable(yOnly)) {
      return yOnly;
    }

    return current;
  }

  private bindSceneEvents(): void {
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.input.on("pointerupoutside", this.onPointerUp, this);
    this.input.on("wheel", this.onWheel, this);
    this.game.events.on(PLACE_OBJECT_DROP_EVENT, this.onPlaceObjectDrop, this);
    this.game.events.on(PLACE_TERRAIN_DROP_EVENT, this.onPlaceTerrainDrop, this);
    this.game.events.on(SELECT_TERRAIN_TOOL_EVENT, this.onSelectTerrainTool, this);
    this.game.events.on(SET_ZOOM_EVENT, this.onSetZoom, this);
    this.events.once("shutdown", this.handleShutdown, this);
  }

  private unbindSceneEvents(): void {
    this.game.events.off(PLACE_OBJECT_DROP_EVENT, this.onPlaceObjectDrop, this);
    this.game.events.off(PLACE_TERRAIN_DROP_EVENT, this.onPlaceTerrainDrop, this);
    this.game.events.off(SELECT_TERRAIN_TOOL_EVENT, this.onSelectTerrainTool, this);
    this.game.events.off(SET_ZOOM_EVENT, this.onSetZoom, this);
    this.input.off("pointerdown", this.onPointerDown, this);
    this.input.off("pointermove", this.onPointerMove, this);
    this.input.off("pointerup", this.onPointerUp, this);
    this.input.off("pointerupoutside", this.onPointerUp, this);
    this.input.off("wheel", this.onWheel, this);
  }

  private handleShutdown(): void {
    this.unbindSceneEvents();
    this.runtimeState.dispose();
  }
}

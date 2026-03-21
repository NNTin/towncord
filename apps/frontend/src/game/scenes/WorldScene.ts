import Phaser from "phaser";
import {
  BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY,
  getBloomseedWorldBootstrap,
} from "../application/gameComposition";
import { RENDER_LAYERS } from "../renderLayers";
import { mapDropPayloadToSpawnRequest } from "../application/spawnRequestMapper";
import type { AnimationCatalog } from "../assets/animationCatalog";
import type { EntityRegistry } from "../domain/entityRegistry";
import {
  OFFICE_SET_EDITOR_TOOL_EVENT,
  OFFICE_FLOOR_PICKED_EVENT,
  OFFICE_LAYOUT_CHANGED_EVENT,
  PLACE_OBJECT_DROP_EVENT,
  PLACE_TERRAIN_DROP_EVENT,
  PLAYER_PLACED_EVENT,
  RUNTIME_PERF_EVENT,
  type OfficeFloorMode,
  SELECT_TERRAIN_TOOL_EVENT,
  TERRAIN_TILE_INSPECTED_EVENT,
  type OfficeFloorPickedPayload,
  type OfficeEditorToolId,
  type OfficeLayoutChangedPayload,
  type OfficeSetEditorToolPayload,
  type PlaceObjectDropPayload,
  type PlaceTerrainDropPayload,
  type PlayerPlacedPayload,
  type RuntimePerfPayload,
  type SelectedTerrainToolPayload,
  type TerrainTileInspectedPayload,
  ZOOM_CHANGED_EVENT,
  SET_ZOOM_EVENT,
  type SetZoomPayload,
} from "../events";
import type { OfficeTileColor } from "../office/model";
import {
  TERRAIN_CELL_WORLD_SIZE,
  TERRAIN_RENDER_GRID_WORLD_OFFSET,
  TERRAIN_TEXTURE_KEY,
  TerrainSystem,
  type TerrainCellCoord,
  type TerrainRenderTile,
} from "../terrain";
import { createTerrainNavigationService, type WorldNavigationService } from "./world/navigation";
import { WorldSceneInputRouter } from "./world/inputRouter";
import { TownCollisionGrid } from "../town/collisionGrid";
import { loadTownOfficeRegion, worldToOfficeCell, officeCellToWorldPixel, TOWN_BASE_PX } from "../town/layout";
import { renderOfficeLayout, type OfficeLayoutRenderable } from "./office/render";
import type { TownOfficeRegion } from "../town/layout";
import { WorldSceneRuntime, type WorldSceneMovementKeys } from "./world/sceneRuntime";
import { TerrainPaintSession } from "./world/terrainPaintSession";
import type { MovementInput } from "./world/movementSystem";
import type { WorldEntity, WorldSelectableActor } from "./world/types";
import { EntitySystem } from "./world/entitySystem";
import { OfficeEditorSystem } from "./world/officeEditorSystem";
import type { OfficeColorAdjust } from "./office/colors";

export const WORLD_SCENE_KEY = "world";

const MIN_ZOOM = 1;
const MAX_ZOOM = 16;
const INITIAL_ZOOM = 2;
const SELECTED_BADGE_ANIMATION_KEY = "props.bloomseed.static.rocks.variant-03";
const SELECTED_BADGE_SCALE = 0.5;
const SELECTED_BADGE_VERTICAL_OFFSET = 3;
const TERRAIN_BRUSH_PREVIEW_ALPHA = 0.18;
const TERRAIN_BRUSH_PREVIEW_STROKE_WIDTH = 2;
const TERRAIN_BRUSH_PREVIEW_READY_FILL = 0x38bdf8;
const TERRAIN_BRUSH_PREVIEW_READY_STROKE = 0xe0f2fe;
const TERRAIN_BRUSH_PREVIEW_BLOCKED_FILL = 0xef4444;
const TERRAIN_BRUSH_PREVIEW_BLOCKED_STROKE = 0xfecaca;
const TERRAIN_BRUSH_RENDER_PREVIEW_ALPHA = 0.72;
const OFFICE_CELL_HIGHLIGHT_FILL = 0x38bdf8;
const OFFICE_CELL_HIGHLIGHT_ALPHA = 0.22;
const OFFICE_CELL_HIGHLIGHT_STROKE_WIDTH = 2;
const OFFICE_CELL_HIGHLIGHT_STROKE = 0xe0f2fe;

export class WorldScene extends Phaser.Scene {
  private readonly runtimeState = new WorldSceneRuntime();

  /** Dedicated system for all per-entity updates (autonomy, movement, animation, position sync). */
  private entitySystem: EntitySystem | null = null;

  /** Dedicated system for office editor tool dispatch (floor/wall/furniture/erase). */
  private readonly officeEditorSystem = new OfficeEditorSystem();
  private readonly inputRouter: WorldSceneInputRouter;

  private get rs(): WorldSceneRuntime {
    return this.runtimeState;
  }

  constructor() {
    super(WORLD_SCENE_KEY);
    this.inputRouter = new WorldSceneInputRouter({
      beginPan: (pointer) => this.beginPan(pointer),
      tryHandleOfficePointerDown: (pointer) => this.tryHandleOfficePointerDown(pointer),
      hasActiveTerrainTool: () => Boolean(this.rs.activeTerrainTool),
      beginTerrainPaint: (pointer) => this.beginTerrainPaint(pointer),
      handleSelectionAndInspect: (pointer) => this.handleSelectionAndInspect(pointer),
      isPanning: () => this.rs.isPanning,
      updatePan: (pointer) => this.updatePan(pointer),
      syncHover: (pointer) => this.syncHover(pointer),
      shouldContinueOfficePainting: (pointer) => this.shouldContinueOfficePainting(pointer),
      continueOfficePainting: (pointer) => this.continueOfficePainting(pointer),
      shouldContinueTerrainPainting: () => this.shouldContinueTerrainPainting(),
      continueTerrainPainting: (pointer) => this.continueTerrainPainting(pointer),
      endPan: (pointer) => this.endPan(pointer),
      endPrimaryPointer: (pointer) => this.endPrimaryPointer(pointer),
    });
  }

  public create(): void {
    const bootstrap = getBloomseedWorldBootstrap(
      this.registry.get(BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY),
    );
    if (bootstrap) {
      this.rs.catalog = bootstrap.catalog;
      this.rs.entityRegistry = bootstrap.entityRegistry;
    }

    this.rs.wasd = this.input.keyboard!.addKeys("W,A,S,D") as WorldSceneMovementKeys;
    this.rs.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    this.rs.terrainSystem = new TerrainSystem(this);
    const officeRegion = loadTownOfficeRegion();
    const collisionGrid = new TownCollisionGrid(
      this.rs.terrainSystem.getGameplayGrid(),
      officeRegion,
    );
    const navigation = createTerrainNavigationService(
      this.rs.terrainSystem.getGameplayGrid(),
      collisionGrid,
    );
    this.rs.navigation = navigation;

    if (this.rs.catalog) {
      this.entitySystem = new EntitySystem({
        scene: this,
        catalog: this.rs.catalog,
        navigation,
        emitGameEvent: (event, payload) => this.game.events.emit(event, payload),
        onSelectedEntityUpdated: (entity) => this.syncSelectionBadgePosition(entity),
      });
    }

    {
      const { anchorX16, anchorY16, layout } = officeRegion;
      this.rs.officeRegion = officeRegion;
      this.rs.officeRenderable = renderOfficeLayout(this, layout, {
        worldOffsetX: anchorX16 * TOWN_BASE_PX,
        worldOffsetY: anchorY16 * TOWN_BASE_PX,
        tileDepth: RENDER_LAYERS.OFFICE_FLOOR,
        depthAnchorRow: anchorY16,
      });
    }
    this.bindSceneEvents();

    this.createSelectionBadge();
    this.createTerrainBrushPreview();
    this.createOfficeCellHighlight();

    const worldBounds = this.rs.terrainSystem.getGameplayGrid().getWorldBounds();
    const cam = this.cameras.main;
    cam.setZoom(INITIAL_ZOOM);
    cam.setScroll(
      worldBounds.width / 2 - cam.width / (2 * INITIAL_ZOOM),
      worldBounds.height / 2 - cam.height / (2 * INITIAL_ZOOM),
    );

    this.game.events.emit(ZOOM_CHANGED_EVENT, {
      zoom: this.cameras.main.zoom,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
  }

  public override update(_time: number, delta: number): void {
    const rs = this.rs;
    const updateStart = performance.now();

    const terrainSystem = rs.terrainSystem;
    const terrainStart = performance.now();
    terrainSystem?.update();
    const terrainMs = performance.now() - terrainStart;

    const { shiftKey, wasd } = rs;
    if (wasd && shiftKey && this.entitySystem) {
      const directInput = this.resolveDirectMovementInput(wasd, shiftKey);
      this.entitySystem.update(delta, directInput);
    }

    const now = performance.now();
    if (now - rs.lastPerfEmitAtMs >= 100) {
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
      rs.lastPerfEmitAtMs = now;
    }

    if (rs.officeDirty) {
      this.rerenderOffice();
      rs.officeDirty = false;
      if (this.rs.officeRegion) {
        const payload: OfficeLayoutChangedPayload = { layout: this.rs.officeRegion.layout };
        this.game.events.emit(OFFICE_LAYOUT_CHANGED_EVENT, payload);
      }
    }
  }

  private selectEntity(entity: WorldEntity | null): void {
    if (this.entitySystem?.getSelected() === entity) return;
    this.entitySystem?.select(entity);
    this.setSelectionBadgeVisible(Boolean(entity));
    if (entity) this.syncSelectionBadgePosition(entity);
  }

  private createSelectionBadge(): void {
    const firstFrame = this.anims.get(SELECTED_BADGE_ANIMATION_KEY)?.frames[0];
    if (!firstFrame) return;

    const badge = this.add.sprite(0, 0, firstFrame.textureKey, firstFrame.textureFrame);
    badge.setScale(SELECTED_BADGE_SCALE);
    badge.setDepth(RENDER_LAYERS.UI_OVERLAY);
    badge.setVisible(false);
    this.rs.selectionBadge = badge;
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
    preview.setDepth(RENDER_LAYERS.TERRAIN_BRUSH_PREVIEW);
    preview.setStrokeStyle(
      TERRAIN_BRUSH_PREVIEW_STROKE_WIDTH,
      TERRAIN_BRUSH_PREVIEW_READY_STROKE,
      0.9,
    );
    preview.setVisible(false);
    this.rs.terrainBrushPreview = preview;
  }

  private createOfficeCellHighlight(): void {
    const cellSize = this.rs.officeRegion?.layout.cellSize ?? 16;
    const highlight = this.add.rectangle(
      0,
      0,
      cellSize,
      cellSize,
      OFFICE_CELL_HIGHLIGHT_FILL,
      OFFICE_CELL_HIGHLIGHT_ALPHA,
    );
    highlight.setOrigin(0, 0);
    highlight.setDepth(RENDER_LAYERS.OFFICE_CELL_HIGHLIGHT);
    highlight.setStrokeStyle(OFFICE_CELL_HIGHLIGHT_STROKE_WIDTH, OFFICE_CELL_HIGHLIGHT_STROKE, 0.9);
    highlight.setVisible(false);
    this.rs.officeCellHighlight = highlight;
  }

  private syncOfficeCellHighlight(pointer: Phaser.Input.Pointer | null): void {
    if (!pointer || !this.rs.activeOfficeTool || !this.rs.officeRegion) {
      this.rs.officeCellHighlight?.setVisible(false);
      return;
    }

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell = worldToOfficeCell(worldPoint.x, worldPoint.y, this.rs.officeRegion);
    if (!cell) {
      this.rs.officeCellHighlight?.setVisible(false);
      return;
    }

    const { worldX, worldY } = officeCellToWorldPixel(cell.col, cell.row, this.rs.officeRegion);
    this.rs.officeCellHighlight?.setPosition(worldX, worldY);
    this.rs.officeCellHighlight?.setVisible(true);
  }

  private setSelectionBadgeVisible(visible: boolean): void {
    if (!this.rs.selectionBadge) return;
    this.rs.selectionBadge.setVisible(visible);
  }

  private setTerrainBrushPreviewVisible(visible: boolean): void {
    if (!this.rs.terrainBrushPreview) return;
    this.rs.terrainBrushPreview.setVisible(visible);
  }

  private hideTerrainBrushRenderPreview(): void {
    for (const image of this.rs.terrainBrushRenderPreviewImages) {
      image.setVisible(false);
    }
  }

  private getTerrainBrushRenderPreviewImage(index: number): Phaser.GameObjects.Image {
    const existing = this.rs.terrainBrushRenderPreviewImages[index];
    if (existing) {
      return existing;
    }

    const image = this.add.image(0, 0, TERRAIN_TEXTURE_KEY);
    image.setAlpha(TERRAIN_BRUSH_RENDER_PREVIEW_ALPHA);
    image.setDepth(RENDER_LAYERS.TERRAIN_BRUSH_PREVIEW - 1);
    image.setVisible(false);
    this.rs.terrainBrushRenderPreviewImages[index] = image;
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

    for (let index = tiles.length; index < this.rs.terrainBrushRenderPreviewImages.length; index += 1) {
      this.rs.terrainBrushRenderPreviewImages[index]?.setVisible(false);
    }
  }

  private syncSelectionBadgePosition(entity: WorldSelectableActor): void {
    if (!this.rs.selectionBadge) return;
    this.rs.selectionBadge.setPosition(
      entity.position.x,
      entity.position.y -
        entity.sprite.displayHeight * EntitySystem.spriteOriginY -
        SELECTED_BADGE_VERTICAL_OFFSET,
    );
  }

  private onPlaceObjectDrop(payload: PlaceObjectDropPayload): void {
    if (!this.rs.catalog || !this.rs.entityRegistry || !this.rs.terrainSystem || !this.entitySystem) return;

    const spawnRequest = mapDropPayloadToSpawnRequest(payload);
    const runtime = this.rs.entityRegistry.getRuntimeById(spawnRequest.entityId);
    if (!runtime || !runtime.definition.placeable) return;
    const { definition } = runtime;

    const worldPoint = this.cameras.main.getWorldPoint(spawnRequest.screenX, spawnRequest.screenY);
    const clamped = this.rs.terrainSystem.getGameplayGrid().clampWorldPoint(worldPoint.x, worldPoint.y);
    if (!this.rs.terrainSystem.getGameplayGrid().isWorldWalkable(clamped.worldX, clamped.worldY)) {
      return;
    }

    const entity = this.entitySystem.addEntity(runtime, clamped.worldX, clamped.worldY);
    if (!entity) return;

    this.selectEntity(entity);

    if (definition.kind === "player") {
      const placedPayload: PlayerPlacedPayload = { worldX: clamped.worldX, worldY: clamped.worldY };
      this.game.events.emit(PLAYER_PLACED_EVENT, placedPayload);
    }
  }

  private onPlaceTerrainDrop(payload: PlaceTerrainDropPayload): void {
    if (!this.rs.terrainSystem) return;
    const worldPoint = this.cameras.main.getWorldPoint(payload.screenX, payload.screenY);
    this.queueTerrainDropAtWorld(payload, worldPoint.x, worldPoint.y);
  }

  private onSelectTerrainTool(payload: SelectedTerrainToolPayload): void {
    this.rs.activeTerrainTool = payload;
    this.rs.terrainPaintSession.end();
    this.syncTerrainBrushPreviewFromPointer(this.input.activePointer);
  }

  private onSetOfficeEditorTool(payload: OfficeSetEditorToolPayload): void {
    switch (payload.tool) {
      case "floor":
        this.rs.activeOfficeTool = "floor";
        this.rs.activeFloorMode = payload.floorMode;
        this.rs.activeTileColor = payload.tileColor;
        this.rs.activeFloorColor = payload.floorColor;
        this.rs.activeFloorPattern = payload.floorPattern;
        this.rs.activeFurnitureId = null;
        break;
      case "furniture":
        this.rs.activeOfficeTool = "furniture";
        this.rs.activeTileColor = null;
        this.rs.activeFloorMode = "paint";
        this.rs.activeFloorColor = null;
        this.rs.activeFloorPattern = null;
        this.rs.activeFurnitureId = payload.furnitureId;
        break;
      case "wall":
      case "erase":
        this.rs.activeOfficeTool = payload.tool;
        this.rs.activeTileColor = null;
        this.rs.activeFloorMode = "paint";
        this.rs.activeFloorColor = null;
        this.rs.activeFloorPattern = null;
        this.rs.activeFurnitureId = null;
        break;
      default:
        this.rs.activeOfficeTool = null;
        this.rs.activeTileColor = null;
        this.rs.activeFloorMode = "paint";
        this.rs.activeFloorColor = null;
        this.rs.activeFloorPattern = null;
        this.rs.activeFurnitureId = null;
        break;
    }
    this.syncOfficeCellHighlight(this.input.activePointer);
  }

  private emitPickedOfficeFloor(payload: OfficeFloorPickedPayload): void {
    this.game.events.emit(OFFICE_FLOOR_PICKED_EVENT, payload);
  }

  private pickOfficeFloor(worldX: number, worldY: number): boolean {
    const region = this.rs.officeRegion;
    if (!region || this.rs.activeOfficeTool !== "floor" || this.rs.activeFloorMode !== "pick") {
      return false;
    }

    const cell = worldToOfficeCell(worldX, worldY, region);
    if (!cell) {
      return false;
    }

    const tile = region.layout.tiles[cell.row * region.layout.cols + cell.col];
    if (!tile || tile.kind !== "floor") {
      this.rs.isOfficePainting = false;
      return true;
    }

    this.emitPickedOfficeFloor({
      floorColor: tile.colorAdjust ? { ...tile.colorAdjust } : null,
      floorPattern: tile.pattern ?? "environment.floors.pattern-01",
    });

    this.rs.isOfficePainting = false;
    this.rs.activeFloorMode = "paint";
    return true;
  }

  /**
   * Applies the active office editor tool at a world-pixel position.
   * Returns true if the point is inside the office region (event consumed),
   * regardless of whether a mutation occurred — this prevents terrain tools
   * from firing through the office floor on the same click.
   * Returns false when the point is outside the office or no region/tool is set.
   */
  private applyOfficeTool(worldX: number, worldY: number): boolean {
    const region = this.rs.officeRegion;
    const tool = this.rs.activeOfficeTool;
    if (!region || !tool) return false;

    const cell = worldToOfficeCell(worldX, worldY, region);
    if (!cell) return false;

    const changed = this.officeEditorSystem.applyCommand(region.layout, {
      tool,
      cell,
      tileColor: this.rs.activeTileColor,
      floorColor: this.rs.activeFloorColor,
      floorPattern: this.rs.activeFloorPattern,
      furnitureId: this.rs.activeFurnitureId,
    });

    if (changed) {
      this.rs.officeDirty = true;
    }

    return true;
  }

  /**
   * Applies a partial update to the rendered office, keeping game objects alive
   * where possible and only creating/destroying what actually changed.
   *
   * - Tile graphics: cleared and redrawn in a single Graphics pass.
   * - Furniture: diffed by id — unchanged containers are kept; removed items are
   *   destroyed; new items are created.
   * - Characters: rebuilt (derived data, infrequent change).
   */
  private rerenderOffice(): void {
    const region = this.rs.officeRegion;
    if (!region) return;

    if (this.rs.officeRenderable) {
      this.rs.officeRenderable.partialUpdate(region.layout);
    } else {
      const { anchorX16, anchorY16, layout } = region;
      this.rs.officeRenderable = renderOfficeLayout(this, layout, {
        worldOffsetX: anchorX16 * TOWN_BASE_PX,
        worldOffsetY: anchorY16 * TOWN_BASE_PX,
        tileDepth: RENDER_LAYERS.OFFICE_FLOOR,
        depthAnchorRow: anchorY16,
      });
    }
  }

  private beginPan(pointer: Phaser.Input.Pointer): void {
    this.rs.isPanning = true;
    this.rs.panStartX = pointer.x;
    this.rs.panStartY = pointer.y;
    this.rs.camStartX = this.cameras.main.scrollX;
    this.rs.camStartY = this.cameras.main.scrollY;
    this.syncTerrainBrushPreviewFromPointer(pointer);
  }

  private tryHandleOfficePointerDown(pointer: Phaser.Input.Pointer): boolean {
    if (!this.rs.activeOfficeTool) {
      return false;
    }

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (this.pickOfficeFloor(worldPoint.x, worldPoint.y)) {
      return true;
    }

    if (this.applyOfficeTool(worldPoint.x, worldPoint.y)) {
      this.rs.isOfficePainting = true;
      return true;
    }

    return false;
  }

  private beginTerrainPaint(pointer: Phaser.Input.Pointer): void {
    this.rs.terrainPaintSession.begin();
    this.syncTerrainBrushPreviewFromPointer(pointer);
    this.paintTerrainAtScreen(pointer.x, pointer.y);
  }

  private handleSelectionAndInspect(pointer: Phaser.Input.Pointer): void {
    let hit: WorldEntity | null = null;
    const hits = this.input.sortGameObjects(this.input.hitTestPointer(pointer), pointer);

    for (const target of hits) {
      const entity = this.entitySystem?.findBySpriteTarget(target) ?? null;
      if (entity) {
        hit = entity;
        break;
      }
    }

    this.selectEntity(hit);

    if (!this.rs.terrainSystem) {
      return;
    }

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const inspected = this.rs.terrainSystem.inspectAtWorld(worldPoint.x, worldPoint.y);
    if (inspected) {
      const payload: TerrainTileInspectedPayload = inspected;
      this.game.events.emit(TERRAIN_TILE_INSPECTED_EVENT, payload);
    }
  }

  private updatePan(pointer: Phaser.Input.Pointer): void {
    const zoom = this.cameras.main.zoom;
    const dx = (pointer.x - this.rs.panStartX) / zoom;
    const dy = (pointer.y - this.rs.panStartY) / zoom;
    this.cameras.main.setScroll(this.rs.camStartX - dx, this.rs.camStartY - dy);
    this.syncTerrainBrushPreviewFromPointer(pointer);
    this.syncOfficeCellHighlight(pointer);
  }

  private syncHover(pointer: Phaser.Input.Pointer): void {
    this.syncTerrainBrushPreviewFromPointer(pointer);
    this.syncOfficeCellHighlight(pointer);
  }

  private shouldContinueOfficePainting(pointer: Phaser.Input.Pointer): boolean {
    return Boolean(this.rs.isOfficePainting && this.rs.activeOfficeTool && pointer.isDown);
  }

  private continueOfficePainting(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.applyOfficeTool(worldPoint.x, worldPoint.y);
  }

  private shouldContinueTerrainPainting(): boolean {
    return Boolean(this.rs.activeTerrainTool && this.rs.terrainPaintSession.isActive());
  }

  private continueTerrainPainting(pointer: Phaser.Input.Pointer): void {
    this.paintTerrainAtScreen(pointer.x, pointer.y);
  }

  private endPan(pointer: Phaser.Input.Pointer): void {
    this.rs.isPanning = false;
    this.syncTerrainBrushPreviewFromPointer(pointer);
  }

  private endPrimaryPointer(pointer: Phaser.Input.Pointer): void {
    this.rs.isOfficePainting = false;
    this.rs.terrainPaintSession.end();
    this.syncTerrainBrushPreviewFromPointer(pointer);
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

  private applyZoom(nextZoom: number): void {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(nextZoom, MIN_ZOOM, MAX_ZOOM));
    this.game.events.emit(ZOOM_CHANGED_EVENT, {
      zoom: cam.zoom,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
  }

  private onWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: unknown,
    _dx: number,
    dy: number,
  ): void {
    const factor = dy > 0 ? 0.9 : 1.1;
    this.applyZoom(this.cameras.main.zoom * factor);
    this.syncTerrainBrushPreviewFromPointer(this.input.activePointer);
  }

  private onSetZoom(payload: SetZoomPayload): void {
    this.applyZoom(payload.zoom);
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
    if (!this.rs.activeTerrainTool || !this.rs.terrainSystem) return;

    const worldPoint = this.cameras.main.getWorldPoint(screenX, screenY);
    const cell = this.rs.terrainSystem.getGameplayGrid().worldToCell(worldPoint.x, worldPoint.y);
    if (!cell || this.isTerrainCellOccupied(cell) || !this.rs.terrainPaintSession.shouldPaintCell(cell)) {
      return;
    }

    this.queueTerrainDropAtWorld(
      {
        type: "terrain",
        materialId: this.rs.activeTerrainTool.materialId,
        brushId: this.rs.activeTerrainTool.brushId,
        screenX,
        screenY,
      },
      worldPoint.x,
      worldPoint.y,
    );
  }

  private syncTerrainBrushPreviewAtScreen(screenX: number, screenY: number): void {
    if (!this.rs.activeTerrainTool || !this.rs.terrainSystem || !this.rs.terrainBrushPreview) {
      this.setTerrainBrushPreviewVisible(false);
      this.hideTerrainBrushRenderPreview();
      return;
    }

    const worldPoint = this.cameras.main.getWorldPoint(screenX, screenY);
    const grid = this.rs.terrainSystem.getGameplayGrid();
    const cell = grid.worldToCell(worldPoint.x, worldPoint.y);
    if (!cell) {
      this.setTerrainBrushPreviewVisible(false);
      this.hideTerrainBrushRenderPreview();
      return;
    }

    const isBlocked = this.isTerrainCellOccupied(cell);
    this.rs.terrainBrushPreview.setFillStyle(
      isBlocked ? TERRAIN_BRUSH_PREVIEW_BLOCKED_FILL : TERRAIN_BRUSH_PREVIEW_READY_FILL,
      TERRAIN_BRUSH_PREVIEW_ALPHA,
    );
    this.rs.terrainBrushPreview.setStrokeStyle(
      TERRAIN_BRUSH_PREVIEW_STROKE_WIDTH,
      isBlocked ? TERRAIN_BRUSH_PREVIEW_BLOCKED_STROKE : TERRAIN_BRUSH_PREVIEW_READY_STROKE,
      0.9,
    );
    // Terrain edits target the placement grid anchor; render tiles are resolved on the dual grid.
    this.rs.terrainBrushPreview.setPosition(
      cell.cellX * TERRAIN_CELL_WORLD_SIZE,
      cell.cellY * TERRAIN_CELL_WORLD_SIZE,
    );
    this.rs.terrainBrushPreview.setVisible(true);

    if (isBlocked) {
      this.hideTerrainBrushRenderPreview();
      return;
    }

    const previewTiles = this.rs.terrainSystem.previewPaintAtWorld(
      {
        type: "terrain",
        materialId: this.rs.activeTerrainTool.materialId,
        brushId: this.rs.activeTerrainTool.brushId,
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
    if (!this.rs.terrainSystem) return;

    const cell = this.rs.terrainSystem.getGameplayGrid().worldToCell(worldX, worldY);
    if (!cell || this.isTerrainCellOccupied(cell)) return;

    this.rs.terrainSystem.queueDrop(payload, worldX, worldY);
  }

  private isTerrainCellOccupied(cell: TerrainCellCoord): boolean {
    if (!this.rs.terrainSystem) return false;

    const grid = this.rs.terrainSystem.getGameplayGrid();
    const entities = this.entitySystem?.getAll() ?? [];
    return entities.some((entity) => {
      const entityCell = grid.worldToCell(entity.position.x, entity.position.y);
      return entityCell?.cellX === cell.cellX && entityCell?.cellY === cell.cellY;
    });
  }

  private resolveDirectMovementInput(
    wasd: WorldSceneMovementKeys | null = this.rs.wasd,
    shiftKey: Phaser.Input.Keyboard.Key | null = this.rs.shiftKey,
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

  private bindSceneEvents(): void {
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.input.on("pointerupoutside", this.onPointerUp, this);
    this.input.on("wheel", this.onWheel, this);
    this.game.events.on(PLACE_OBJECT_DROP_EVENT, this.onPlaceObjectDrop, this);
    this.game.events.on(PLACE_TERRAIN_DROP_EVENT, this.onPlaceTerrainDrop, this);
    this.game.events.on(SELECT_TERRAIN_TOOL_EVENT, this.onSelectTerrainTool, this);
    this.game.events.on(OFFICE_SET_EDITOR_TOOL_EVENT, this.onSetOfficeEditorTool, this);
    this.game.events.on(SET_ZOOM_EVENT, this.onSetZoom, this);
    this.events.once("shutdown", this.handleShutdown, this);
  }

  private unbindSceneEvents(): void {
    this.game.events.off(PLACE_OBJECT_DROP_EVENT, this.onPlaceObjectDrop, this);
    this.game.events.off(PLACE_TERRAIN_DROP_EVENT, this.onPlaceTerrainDrop, this);
    this.game.events.off(SELECT_TERRAIN_TOOL_EVENT, this.onSelectTerrainTool, this);
    this.game.events.off(OFFICE_SET_EDITOR_TOOL_EVENT, this.onSetOfficeEditorTool, this);
    this.game.events.off(SET_ZOOM_EVENT, this.onSetZoom, this);
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
    this.rs.dispose();
  }
}

import Phaser from "phaser";
import {
  BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY,
  getBloomseedWorldBootstrap,
} from "../application/gameComposition";
import { mapDropPayloadToSpawnRequest } from "../application/spawnRequestMapper";
import type { AnimationCatalog } from "../assets/animationCatalog";
import type { EntityRegistry } from "../domain/entityRegistry";
import {
  OFFICE_SET_EDITOR_TOOL_EVENT,
  OFFICE_LAYOUT_CHANGED_EVENT,
  PLACE_OBJECT_DROP_EVENT,
  PLACE_TERRAIN_DROP_EVENT,
  PLAYER_PLACED_EVENT,
  PLAYER_STATE_CHANGED_EVENT,
  RUNTIME_PERF_EVENT,
  SELECT_TERRAIN_TOOL_EVENT,
  TERRAIN_TILE_INSPECTED_EVENT,
  type OfficeEditorToolId,
  type OfficeLayoutChangedPayload,
  type OfficeSetEditorToolPayload,
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
import { TownCollisionGrid } from "../town/collisionGrid";
import { loadTownOfficeRegion, worldToOfficeCell, officeCellToWorldPixel, TOWN_BASE_PX } from "../town/layout";
import { renderOfficeLayout, type OfficeLayoutRenderable } from "./office/render";
import { OFFICE_TILE_COLOR_TINTS } from "./office/colors";
import { FURNITURE_PALETTE_ITEMS } from "../office/officeFurniturePalette";
import type { OfficeSceneFurniture, OfficeSceneFurnitureCategory } from "./office/bootstrap";
import type { TownOfficeRegion } from "../town/layout";
import { WorldSceneRuntime, type WorldSceneMovementKeys } from "./world/sceneRuntime";
import { TerrainPaintSession } from "./world/terrainPaintSession";
import { updateEntityMovement, type MovementInput } from "./world/movementSystem";
import type { WorldEntity, WorldPoint, WorldSelectableActor } from "./world/types";

export const WORLD_SCENE_KEY = "world";

// Monotonic counter to ensure unique IDs for placed office furniture.
let nextFurniturePlacementId = 1;

const SPRITE_SCALE = 4;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const SELECTED_BADGE_ANIMATION_KEY = "props.bloomseed.static.rocks.variant-03";
const SELECTED_BADGE_SCALE = 2;
const SELECTED_BADGE_VERTICAL_OFFSET = 12;
// TODO(architecture-review): Depth constants are scattered magic numbers with no named layer
// taxonomy. Centralize render-layers module (e.g. src/game/renderLayers.ts)
// that exports a plain const-asserted object: RENDER_LAYERS = { TERRAIN_STATIC: -1000,
// TERRAIN_ANIMATED: -999, OFFICE_FLOOR: -500, ENTITIES: <y-sorted>, EFFECTS: 5000,
// UI_OVERLAY: 10000 }. Migrate incrementally by replacing one layer at a time.
/** Depth for the office tile layer. Sits above terrain (TERRAIN_RENDER_DEPTH = -1000) and below entities. */
const OFFICE_TILE_DEPTH = -500;
const TERRAIN_BRUSH_PREVIEW_DEPTH = 9_000;
const TERRAIN_BRUSH_PREVIEW_ALPHA = 0.18;
const TERRAIN_BRUSH_PREVIEW_STROKE_WIDTH = 2;
const TERRAIN_BRUSH_PREVIEW_READY_FILL = 0x38bdf8;
const TERRAIN_BRUSH_PREVIEW_READY_STROKE = 0xe0f2fe;
const TERRAIN_BRUSH_PREVIEW_BLOCKED_FILL = 0xef4444;
const TERRAIN_BRUSH_PREVIEW_BLOCKED_STROKE = 0xfecaca;
const TERRAIN_BRUSH_RENDER_PREVIEW_ALPHA = 0.72;

const OFFICE_CELL_HIGHLIGHT_DEPTH = 8_000;
const OFFICE_CELL_HIGHLIGHT_FILL = 0x38bdf8;
const OFFICE_CELL_HIGHLIGHT_ALPHA = 0.22;
const OFFICE_CELL_HIGHLIGHT_STROKE_WIDTH = 2;
const OFFICE_CELL_HIGHLIGHT_STROKE = 0xe0f2fe;

// TODO(architecture-review): WorldScene is a god class (~1080 lines) that owns terrain,
// office layout, entity lifecycle, navigation, input handling, camera, selection UI, and
// brush preview all in one place. Recommended refactoring order: (1) extract EntitySystem
// (stateful class wrapping the entity array, movement, animation, y-sort) to unblock
// independent unit tests; (2) extract OfficeEditorSystem (stateful, owns layout mutations
// and dirty flag); (3) extract CameraSystem (pure-functional helpers for pan/zoom). Each
// system should be a stateful class injected into WorldScene, not a pure-function module,
// because they require access to Phaser game objects across multiple frames.
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

  private get officeCellHighlight(): Phaser.GameObjects.Rectangle | null {
    return this.runtimeState.officeCellHighlight;
  }

  private set officeCellHighlight(value: Phaser.GameObjects.Rectangle | null) {
    this.runtimeState.officeCellHighlight = value;
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

  private get officeRenderable(): OfficeLayoutRenderable | null {
    return this.runtimeState.officeRenderable;
  }

  private set officeRenderable(value: OfficeLayoutRenderable | null) {
    this.runtimeState.officeRenderable = value;
  }

  private get officeRegion(): TownOfficeRegion | null {
    return this.runtimeState.officeRegion;
  }

  private set officeRegion(value: TownOfficeRegion | null) {
    this.runtimeState.officeRegion = value;
  }

  private get activeOfficeTool(): OfficeEditorToolId | null {
    return this.runtimeState.activeOfficeTool;
  }

  private set activeOfficeTool(value: OfficeEditorToolId | null) {
    this.runtimeState.activeOfficeTool = value;
  }

  private get activeTileColor(): string {
    return this.runtimeState.activeTileColor;
  }

  private set activeTileColor(value: string) {
    this.runtimeState.activeTileColor = value;
  }

  private get activeFurnitureId(): string | null {
    return this.runtimeState.activeFurnitureId;
  }

  private set activeFurnitureId(value: string | null) {
    this.runtimeState.activeFurnitureId = value;
  }

  private get isOfficePainting(): boolean {
    return this.runtimeState.isOfficePainting;
  }

  private set isOfficePainting(value: boolean) {
    this.runtimeState.isOfficePainting = value;
  }

  private get officeDirty(): boolean {
    return this.runtimeState.officeDirty;
  }

  private set officeDirty(value: boolean) {
    this.runtimeState.officeDirty = value;
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
    const officeRegion = loadTownOfficeRegion();
    const collisionGrid = new TownCollisionGrid(
      this.terrainSystem.getGameplayGrid(),
      officeRegion,
    );
    this.navigation = createTerrainNavigationService(
      this.terrainSystem.getGameplayGrid(),
      collisionGrid,
    );

    {
      const { anchorX16, anchorY16, layout } = officeRegion;
      this.officeRegion = officeRegion;
      this.officeRenderable = renderOfficeLayout(this, layout, {
        worldOffsetX: anchorX16 * TOWN_BASE_PX,
        worldOffsetY: anchorY16 * TOWN_BASE_PX,
        tileDepth: OFFICE_TILE_DEPTH,
        depthAnchorRow: Math.round(anchorY16 / 3),
      });
    }
    this.bindSceneEvents();

    this.createSelectionBadge();
    this.createTerrainBrushPreview();
    this.createOfficeCellHighlight();

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

      // TODO(architecture-review): Entity update (autonomy, movement, animation, position
      // sync) is inlined directly inside WorldScene.update(). This logic should live in a
      // dedicated EntitySystem.update() method so the per-entity pipeline is independently
      // testable and WorldScene.update() becomes a thin coordinator.
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
        // TODO(architecture-review): World entity sprites have no y-sort depth applied —
        // their Phaser depth is fixed at creation time. Office furniture IS y-sorted via
        // resolveRenderableDepth(), but bloomseed entities are not, so an entity standing
        // behind a piece of furniture will incorrectly appear in front of it. A y-sort
        // pass (entity.sprite.setDepth(entity.position.y)) should be applied here.
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

    if (runtimeState.officeDirty) {
      this.rerenderOffice();
      runtimeState.officeDirty = false;
      if (this.officeRegion) {
        const payload: OfficeLayoutChangedPayload = { layout: this.officeRegion.layout };
        this.game.events.emit(OFFICE_LAYOUT_CHANGED_EVENT, payload);
      }
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

  private createOfficeCellHighlight(): void {
    const cellSize = this.officeRegion?.layout.cellSize ?? 48;
    const highlight = this.add.rectangle(
      0,
      0,
      cellSize,
      cellSize,
      OFFICE_CELL_HIGHLIGHT_FILL,
      OFFICE_CELL_HIGHLIGHT_ALPHA,
    );
    highlight.setOrigin(0, 0);
    highlight.setDepth(OFFICE_CELL_HIGHLIGHT_DEPTH);
    highlight.setStrokeStyle(OFFICE_CELL_HIGHLIGHT_STROKE_WIDTH, OFFICE_CELL_HIGHLIGHT_STROKE, 0.9);
    highlight.setVisible(false);
    this.officeCellHighlight = highlight;
  }

  private syncOfficeCellHighlight(pointer: Phaser.Input.Pointer | null): void {
    if (!pointer || !this.activeOfficeTool || !this.officeRegion) {
      this.officeCellHighlight?.setVisible(false);
      return;
    }

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell = worldToOfficeCell(worldPoint.x, worldPoint.y, this.officeRegion);
    if (!cell) {
      this.officeCellHighlight?.setVisible(false);
      return;
    }

    const { worldX, worldY } = officeCellToWorldPixel(cell.col, cell.row, this.officeRegion);
    this.officeCellHighlight?.setPosition(worldX, worldY);
    this.officeCellHighlight?.setVisible(true);
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

  private onSetOfficeEditorTool(payload: OfficeSetEditorToolPayload): void {
    this.activeOfficeTool = payload.tool;
    this.activeTileColor = payload.tileColor ?? "neutral";
    this.activeFurnitureId = payload.furnitureId;
    this.syncOfficeCellHighlight(this.input.activePointer);
  }

  /**
   * Applies the active office editor tool at a world-pixel position.
   * Returns true if the point is inside the office region (event consumed),
   * regardless of whether a mutation occurred — this prevents terrain tools
   * from firing through the office floor on the same click.
   * Returns false when the point is outside the office or no region/tool is set.
   */
  // TODO(architecture-review): Office editor tool logic (floor paint, wall paint, furniture
  // placement, erase) is implemented directly inside WorldScene as a large switch statement.
  // This should be extracted into a dedicated OfficeEditorSystem that accepts a command and
  // a layout document and returns a new document (or a mutation). WorldScene would then
  // dispatch commands to the system rather than performing mutations itself.
  private applyOfficeTool(worldX: number, worldY: number): boolean {
    const region = this.officeRegion;
    const tool = this.activeOfficeTool;
    if (!region || !tool) return false;

    const cell = worldToOfficeCell(worldX, worldY, region);
    if (!cell) return false;

    const layout = region.layout;
    const idx = cell.row * layout.cols + cell.col;

    switch (tool) {
      case "floor": {
        const tile = layout.tiles[idx];
        if (!tile) return true;
        const tint = OFFICE_TILE_COLOR_TINTS[this.activeTileColor] ?? OFFICE_TILE_COLOR_TINTS.neutral ?? 0x475569;
        if (tile.kind === "floor" && tile.tint === tint) return true;
        tile.kind = "floor";
        tile.tint = tint;
        this.officeDirty = true;
        return true;
      }
      case "wall": {
        const tile = layout.tiles[idx];
        if (!tile) return true;
        if (tile.kind === "wall") return true;
        tile.kind = "wall";
        delete tile.tint;
        this.officeDirty = true;
        return true;
      }
      case "erase": {
        const tile = layout.tiles[idx];
        const furnitureAtCell = layout.furniture.filter(
          (f) => cell.col >= f.col && cell.col < f.col + f.width &&
                 cell.row >= f.row && cell.row < f.row + f.height,
        );
        if ((tile?.kind === "void" || !tile) && furnitureAtCell.length === 0) return true;
        if (tile) { tile.kind = "void"; delete tile.tint; }
        if (furnitureAtCell.length > 0) {
          const removeIds = new Set(furnitureAtCell.map((f) => f.id));
          layout.furniture = layout.furniture.filter((f) => !removeIds.has(f.id));
        }
        this.officeDirty = true;
        return true;
      }
      case "furniture": {
        const furnitureId = this.activeFurnitureId;
        if (!furnitureId) return true;
        const paletteItem = FURNITURE_PALETTE_ITEMS.find((item) => item.id === furnitureId);
        if (!paletteItem) return true;

        if (cell.col + paletteItem.footprintW > layout.cols || cell.row + paletteItem.footprintH > layout.rows) {
          return true;
        }

        // Remove existing furniture that overlaps the new placement footprint.
        const newRight = cell.col + paletteItem.footprintW;
        const newBottom = cell.row + paletteItem.footprintH;
        layout.furniture = layout.furniture.filter(
          (f) => f.col >= newRight || f.col + f.width <= cell.col ||
                 f.row >= newBottom || f.row + f.height <= cell.row,
        );

        const newFurniture: OfficeSceneFurniture = {
          id: `placed-${furnitureId}-${nextFurniturePlacementId++}`,
          assetId: furnitureId,
          label: paletteItem.label,
          category: paletteItem.category as OfficeSceneFurnitureCategory,
          placement: paletteItem.placement,
          col: cell.col,
          row: cell.row,
          width: paletteItem.footprintW,
          height: paletteItem.footprintH,
          color: paletteItem.color,
          accentColor: paletteItem.accentColor,
        };

        layout.furniture.push(newFurniture);
        this.officeDirty = true;
        return true;
      }
    }

    return false;
  }

  // TODO(architecture-review): rerenderOffice() fully destroys and recreates every office
  // game object on each dirty frame. For larger layouts this is expensive. Make a
  // partial update strategy: keep the tile Graphics layer and furniture containers alive,
  // and only re-draw changed tiles or re-position affected furniture instances rather than
  // rebuilding the entire scene graph from scratch.
  private rerenderOffice(): void {
    const region = this.officeRegion;
    if (!region) return;

    this.officeRenderable?.destroy();
    const { anchorX16, anchorY16, layout } = region;
    this.officeRenderable = renderOfficeLayout(this, layout, {
      worldOffsetX: anchorX16 * TOWN_BASE_PX,
      worldOffsetY: anchorY16 * TOWN_BASE_PX,
      tileDepth: -500,
      depthAnchorRow: Math.round(anchorY16 / 3),
    });
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
      if (this.activeOfficeTool) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        if (this.applyOfficeTool(worldPoint.x, worldPoint.y)) {
          this.isOfficePainting = true;
          return;
        }
      }

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
      this.syncOfficeCellHighlight(pointer);
      return;
    }

    this.syncTerrainBrushPreviewFromPointer(pointer);
    this.syncOfficeCellHighlight(pointer);

    if (this.isOfficePainting && this.activeOfficeTool && pointer.isDown) {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.applyOfficeTool(worldPoint.x, worldPoint.y);
      return;
    }

    if (!this.activeTerrainTool) return;
    if (!this.terrainPaintSession.isActive()) return;
    this.paintTerrainAtScreen(pointer.x, pointer.y);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 1) {
      this.isPanning = false;
      this.syncTerrainBrushPreviewFromPointer(pointer);
    } else if (pointer.button === 0) {
      this.isOfficePainting = false;
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
    this.runtimeState.dispose();
  }
}

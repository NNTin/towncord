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

// Review: Separation of Concerns — WorldScene is a God Object (~992 LOC). It
// coordinates entity lifecycle, terrain brush previews, office editor tool
// dispatch, camera panning, zoom handling, and all input routing. Each of these
// is an independent concern. Extract them into dedicated systems that WorldScene
// merely wires together in create() and delegates to in update():
//   - InputRouter        (pointerdown/move/up/wheel dispatch)
//   - CameraController   (pan, zoom, zoom-changed emit)
//   - TerrainBrushPreviewSystem (preview rectangle + render preview images)
//   - OfficePaintSession (cell highlight, apply-tool loop, dirty flag)
// WorldScene should become a thin coordinator: ~100–150 LOC that creates systems
// in create(), ticks them in update(), and tears them down in shutdown.
export class WorldScene extends Phaser.Scene {
  private readonly runtimeState = new WorldSceneRuntime();

  /** Dedicated system for all per-entity updates (autonomy, movement, animation, position sync). */
  private entitySystem: EntitySystem | null = null;

  /** Dedicated system for office editor tool dispatch (floor/wall/furniture/erase). */
  private readonly officeEditorSystem = new OfficeEditorSystem();

  // Review: Separation of Concerns — ~235 lines of trivial getter/setter pairs
  // (lines 85–320) exist solely to proxy runtimeState fields through the scene.
  // This layer adds no logic, no validation, and no encapsulation — every getter
  // returns `this.runtimeState.X` and every setter assigns to it.
  //
  // Preferred fix: access `this.runtimeState` directly (it is already a private
  // field) or, if encapsulation is desired, expose runtimeState through a single
  // `private get rs()` shorthand and replace `this.catalog` with `this.rs.catalog`.
  // This would remove ~200 lines of mechanical boilerplate and make the scene's
  // actual logic easier to read and maintain.
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

  /**
   * Provides direct access to the entity array for test harnesses that need to
   * inject mock entities (e.g. to simulate occupied terrain cells).  In
   * production code, the entity lifecycle is managed by EntitySystem.
   */
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

  private get activeTileColor(): OfficeTileColor | null {
    return this.runtimeState.activeTileColor;
  }

  private set activeTileColor(value: OfficeTileColor | null) {
    this.runtimeState.activeTileColor = value;
  }

  private get activeFloorColor(): OfficeColorAdjust | null {
    return this.runtimeState.activeFloorColor;
  }

  private set activeFloorColor(value: OfficeColorAdjust | null) {
    this.runtimeState.activeFloorColor = value;
  }

  private get activeFloorPattern(): string | null {
    return this.runtimeState.activeFloorPattern;
  }

  private get activeFloorMode(): OfficeFloorMode {
    return this.runtimeState.activeFloorMode;
  }

  private set activeFloorMode(value: OfficeFloorMode) {
    this.runtimeState.activeFloorMode = value;
  }

  private set activeFloorPattern(value: string | null) {
    this.runtimeState.activeFloorPattern = value;
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
    const navigation = createTerrainNavigationService(
      this.terrainSystem.getGameplayGrid(),
      collisionGrid,
    );
    this.navigation = navigation;

    if (this.catalog) {
      this.entitySystem = new EntitySystem({
        scene: this,
        catalog: this.catalog,
        navigation,
        emitGameEvent: (event, payload) => this.game.events.emit(event, payload),
        onSelectedEntityUpdated: (entity) => this.syncSelectionBadgePosition(entity),
      });
    }

    {
      const { anchorX16, anchorY16, layout } = officeRegion;
      this.officeRegion = officeRegion;
      this.officeRenderable = renderOfficeLayout(this, layout, {
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

    const { shiftKey, wasd } = runtimeState;
    if (wasd && shiftKey && this.entitySystem) {
      const directInput = this.resolveDirectMovementInput(wasd, shiftKey);
      this.entitySystem.update(delta, directInput);
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
    preview.setDepth(RENDER_LAYERS.TERRAIN_BRUSH_PREVIEW);
    preview.setStrokeStyle(
      TERRAIN_BRUSH_PREVIEW_STROKE_WIDTH,
      TERRAIN_BRUSH_PREVIEW_READY_STROKE,
      0.9,
    );
    preview.setVisible(false);
    this.terrainBrushPreview = preview;
  }

  private createOfficeCellHighlight(): void {
    const cellSize = this.officeRegion?.layout.cellSize ?? 16;
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
    image.setDepth(RENDER_LAYERS.TERRAIN_BRUSH_PREVIEW - 1);
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
        entity.sprite.displayHeight * EntitySystem.spriteOriginY -
        SELECTED_BADGE_VERTICAL_OFFSET,
    );
  }

  private onPlaceObjectDrop(payload: PlaceObjectDropPayload): void {
    if (!this.catalog || !this.entityRegistry || !this.terrainSystem || !this.entitySystem) return;

    const spawnRequest = mapDropPayloadToSpawnRequest(payload);
    const runtime = this.entityRegistry.getRuntimeById(spawnRequest.entityId);
    if (!runtime || !runtime.definition.placeable) return;
    const { definition } = runtime;

    const worldPoint = this.cameras.main.getWorldPoint(spawnRequest.screenX, spawnRequest.screenY);
    const clamped = this.terrainSystem.getGameplayGrid().clampWorldPoint(worldPoint.x, worldPoint.y);
    if (!this.terrainSystem.getGameplayGrid().isWorldWalkable(clamped.worldX, clamped.worldY)) {
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
    if (!this.terrainSystem) return;
    const worldPoint = this.cameras.main.getWorldPoint(payload.screenX, payload.screenY);
    this.queueTerrainDropAtWorld(payload, worldPoint.x, worldPoint.y);
  }

  private onSelectTerrainTool(payload: SelectedTerrainToolPayload): void {
    this.activeTerrainTool = payload;
    this.terrainPaintSession.end();
    this.syncTerrainBrushPreviewFromPointer(this.input.activePointer);
  }

  // Review: One Way Data Flow — this handler manually destructures every field
  // from the payload into individual runtimeState properties. Adding a new tool
  // property requires changes in events.ts, App.tsx, useBloomseedUiBridge.ts,
  // AND here. Store the payload as a single `activeEditorConfig` object on
  // runtimeState and read fields from it when needed (e.g. in applyOfficeTool).
  // This reduces the coupling surface to one producer (React) and one shape
  // (OfficeSetEditorToolPayload).
  private onSetOfficeEditorTool(payload: OfficeSetEditorToolPayload): void {
    this.activeOfficeTool = payload.tool;
    this.activeTileColor = payload.tileColor ?? null;
    this.activeFloorMode = payload.floorMode ?? "paint";
    this.activeFloorColor = payload.floorColor ?? null;
    this.activeFloorPattern = payload.floorPattern ?? null;
    this.activeFurnitureId = payload.furnitureId;
    this.syncOfficeCellHighlight(this.input.activePointer);
  }

  private emitPickedOfficeFloor(payload: OfficeFloorPickedPayload): void {
    this.game.events.emit(OFFICE_FLOOR_PICKED_EVENT, payload);
  }

  private pickOfficeFloor(worldX: number, worldY: number): boolean {
    const region = this.officeRegion;
    if (!region || this.activeOfficeTool !== "floor" || this.activeFloorMode !== "pick") {
      return false;
    }

    const cell = worldToOfficeCell(worldX, worldY, region);
    if (!cell) {
      return false;
    }

    const tile = region.layout.tiles[cell.row * region.layout.cols + cell.col];
    if (!tile || tile.kind !== "floor") {
      this.isOfficePainting = false;
      return true;
    }

    this.emitPickedOfficeFloor({
      floorColor: tile.colorAdjust ? { ...tile.colorAdjust } : null,
      floorPattern: tile.pattern ?? "environment.floors.pattern-01",
    });

    this.isOfficePainting = false;
    this.activeFloorMode = "paint";
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
    const region = this.officeRegion;
    const tool = this.activeOfficeTool;
    if (!region || !tool) return false;

    const cell = worldToOfficeCell(worldX, worldY, region);
    if (!cell) return false;

    const changed = this.officeEditorSystem.applyCommand(region.layout, {
      tool,
      cell,
      tileColor: this.activeTileColor,
      floorColor: this.activeFloorColor,
      floorPattern: this.activeFloorPattern,
      furnitureId: this.activeFurnitureId,
    });

    if (changed) {
      this.officeDirty = true;
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
    const region = this.officeRegion;
    if (!region) return;

    if (this.officeRenderable) {
      this.officeRenderable.partialUpdate(region.layout);
    } else {
      const { anchorX16, anchorY16, layout } = region;
      this.officeRenderable = renderOfficeLayout(this, layout, {
        worldOffsetX: anchorX16 * TOWN_BASE_PX,
        worldOffsetY: anchorY16 * TOWN_BASE_PX,
        tileDepth: RENDER_LAYERS.OFFICE_FLOOR,
        depthAnchorRow: anchorY16,
      });
    }
  }

  // Review: Separation of Concerns — onPointerDown routes three unrelated
  // concerns (camera pan, office tool application, terrain paint + entity
  // selection) inside a single method with nested early returns. Extract an
  // InputRouter system that dispatches pointer events to the active subsystem
  // based on priority: pan → office tool → terrain tool → entity selection.
  // Each subsystem would implement a common InputHandler interface with
  // `onDown(worldPoint) → boolean` (consumed flag), making the dispatch chain
  // explicit and independently testable.
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
        if (this.pickOfficeFloor(worldPoint.x, worldPoint.y)) {
          return;
        }
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
        const entity = this.entitySystem?.findBySpriteTarget(target) ?? null;
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

  // Review: De-duplication — onWheel and onSetZoom both clamp the zoom and
  // emit ZOOM_CHANGED_EVENT with the same shape. Extract a shared
  // `applyZoom(nextZoom: number)` method that clamps, sets, and emits once.
  // Both callers then reduce to one-liners.
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

  // Review: One Way Data Flow — this method reaches into two different sources
  // of truth for entities (EntitySystem vs runtimeState.entities) to work around
  // test harnesses that bypass EntitySystem. This dual-source pattern indicates
  // the entity array ownership is split. EntitySystem should be the single owner;
  // test harnesses should create a minimal EntitySystem (or a mock implementing
  // the same interface) instead of injecting into runtimeState directly. See also
  // the review on sceneRuntime.ts about duplicated entity state.
  private isTerrainCellOccupied(cell: TerrainCellCoord): boolean {
    if (!this.terrainSystem) return false;

    const grid = this.terrainSystem.getGameplayGrid();
    // Prefer EntitySystem-managed entities; fall back to runtimeState.entities
    // for test harnesses that inject mock entity positions directly.
    const entities = this.entitySystem?.getAll().length
      ? this.entitySystem.getAll()
      : this.runtimeState.entities;
    return entities.some((entity) => {
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
    this.runtimeState.dispose();
  }
}

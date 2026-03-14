import Phaser from "phaser";
import {
  OFFICE_SET_EDITOR_TOOL_EVENT,
  SET_ZOOM_EVENT,
  ZOOM_CHANGED_EVENT,
  type OfficeEditorToolId,
  type OfficeSetEditorToolPayload,
  type SetZoomPayload,
} from "../events";
import {
  createOfficeSceneBootstrap,
  getOfficeSceneBootstrap,
  OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY,
  type OfficeSceneBootstrap,
  type OfficeSceneFurniture,
  type OfficeSceneFurnitureCategory,
  type OfficeSceneLayout,
} from "./office/bootstrap";
import {
  OFFICE_CAMERA_CHANGED_EVENT,
  OFFICE_POINTER_MOVED_EVENT,
  OFFICE_SELECTION_CHANGED_EVENT,
  type OfficePointerMovedPayload,
  type OfficeSceneCellCoord,
  type OfficeSceneHoverTarget,
  type OfficeSelectionChangedPayload,
} from "./office/events";
import {
  renderOfficeLayout,
  type OfficeLayoutRenderable,
  type OfficeRenderableTarget,
  type OfficeSceneRenderIndex,
} from "./office/render";
import { FURNITURE_PALETTE_ITEMS, type FurniturePaletteItem } from "../office/officeFurniturePalette";
import { OFFICE_TILE_COLOR_TINTS } from "./office/colors";

export const OFFICE_SCENE_KEY = "office";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const CAMERA_PADDING = 96;
const HOVER_STROKE_COLOR = 0x38bdf8;
const SELECTED_STROKE_COLOR = 0xf59e0b;
const GHOST_COLOR = 0x38bdf8;
const DONARG_OFFICE_FURNITURE_ATLAS_KEY = "donarg.office.furniture";

// OfficeTileColor → hex tint for OfficeSceneTile
const TILE_COLOR_TINTS = OFFICE_TILE_COLOR_TINTS;

type ResolvedPointerState = {
  cell: OfficeSceneCellCoord | null;
  worldX: number;
  worldY: number;
  target: OfficeRenderableTarget | null;
};

export class OfficeScene extends Phaser.Scene {
  private bootstrap: OfficeSceneBootstrap = createOfficeSceneBootstrap();

  private layout: OfficeSceneLayout = this.bootstrap.layout;

  private renderable: OfficeLayoutRenderable | null = null;

  private get renderIndex(): OfficeSceneRenderIndex {
    return this.renderable?.renderIndex ?? { furniture: [], characters: [] };
  }

  private hoverCell: OfficeSceneCellCoord | null = null;

  private hoverTarget: OfficeRenderableTarget | null = null;

  private selectedCell: OfficeSceneCellCoord | null = null;

  private selectedTarget: OfficeRenderableTarget | null = null;

  private hoverMarker: Phaser.GameObjects.Rectangle | null = null;

  private selectionMarker: Phaser.GameObjects.Rectangle | null = null;

  private ghostMarker: Phaser.GameObjects.Rectangle | null = null;

  private ghostSprite: Phaser.GameObjects.Image | null = null;

  private ghostSpriteItemId: string | null = null;

  private overlayText: Phaser.GameObjects.Text | null = null;

  private isPanning = false;

  private isPainting = false;

  private panStartPointer = new Phaser.Math.Vector2();

  private panStartScroll = new Phaser.Math.Vector2();

  // Editor tool state
  private activeTool: OfficeEditorToolId | null = null;

  private activeTileColor = "neutral";

  private activeFurnitureId: string | null = null;

  private furnitureRotationTurns: 0 | 1 | 2 | 3 = 0;

  private rKey: Phaser.Input.Keyboard.Key | null = null;

  private furniturePaletteMap: Map<string, FurniturePaletteItem> = new Map(
    FURNITURE_PALETTE_ITEMS.map((item) => [item.id, item]),
  );

  constructor() {
    super(OFFICE_SCENE_KEY);
  }

  public create(): void {
    const bootstrap = getOfficeSceneBootstrap(
      this.registry.get(OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY),
    );
    this.bootstrap = bootstrap ?? createOfficeSceneBootstrap();
    this.layout = this.bootstrap.layout;

    this.input.mouse?.disableContextMenu();

    this.renderable = renderOfficeLayout(this, this.layout);
    this.createMarkers();
    this.createOverlay();
    this.configureCamera();
    this.bindSceneEvents();
    this.refreshOverlay();
    this.emitZoomChanged();
    this.emitCameraChanged();
  }

  private bindSceneEvents(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onPointerWheel, this);
    this.input.on(Phaser.Input.Events.GAME_OUT, this.onGameOut, this);
    this.game.events.on(SET_ZOOM_EVENT, this.onSetZoom, this);
    this.game.events.on(OFFICE_SET_EDITOR_TOOL_EVENT, this.onSetEditorTool, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    if (this.input.keyboard) {
      this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
      this.rKey.on("down", this.onRKeyDown, this);
    }
  }

  private onShutdown(): void {
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onPointerWheel, this);
    this.input.off(Phaser.Input.Events.GAME_OUT, this.onGameOut, this);
    this.game.events.off(SET_ZOOM_EVENT, this.onSetZoom, this);
    this.game.events.off(OFFICE_SET_EDITOR_TOOL_EVENT, this.onSetEditorTool, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.rKey?.off("down", this.onRKeyDown, this);
  }

  private createMarkers(): void {
    const { cellSize } = this.layout;

    this.hoverMarker = this.add.rectangle(0, 0, cellSize, cellSize);
    this.hoverMarker.setOrigin(0);
    this.hoverMarker.setFillStyle(HOVER_STROKE_COLOR, 0.12);
    this.hoverMarker.setStrokeStyle(2, HOVER_STROKE_COLOR, 0.95);
    this.hoverMarker.setVisible(false);
    this.hoverMarker.setDepth(20_000);

    this.selectionMarker = this.add.rectangle(0, 0, cellSize, cellSize);
    this.selectionMarker.setOrigin(0);
    this.selectionMarker.setFillStyle(SELECTED_STROKE_COLOR, 0.12);
    this.selectionMarker.setStrokeStyle(2, SELECTED_STROKE_COLOR, 1);
    this.selectionMarker.setVisible(false);
    this.selectionMarker.setDepth(20_001);

    this.ghostMarker = this.add.rectangle(0, 0, cellSize, cellSize);
    this.ghostMarker.setOrigin(0);
    this.ghostMarker.setFillStyle(GHOST_COLOR, 0.22);
    this.ghostMarker.setStrokeStyle(2, GHOST_COLOR, 0.85);
    this.ghostMarker.setVisible(false);
    this.ghostMarker.setDepth(20_002);
  }

  private createOverlay(): void {
    this.overlayText = this.add.text(16, 16, "", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#e2e8f0",
      backgroundColor: "rgba(2, 6, 23, 0.72)",
      padding: {
        x: 10,
        y: 8,
      },
    });
    this.overlayText.setDepth(30_000);
    this.overlayText.setScrollFactor(0);
  }

  private configureCamera(): void {
    const camera = this.cameras.main;
    const worldWidth = this.layout.cols * this.layout.cellSize;
    const worldHeight = this.layout.rows * this.layout.cellSize;

    camera.setBackgroundColor("#020617");
    camera.setBounds(
      -CAMERA_PADDING,
      -CAMERA_PADDING,
      worldWidth + CAMERA_PADDING * 2,
      worldHeight + CAMERA_PADDING * 2,
    );
    camera.centerOn(worldWidth / 2, worldHeight / 2);
    camera.setZoom(1);
  }

  private onSetEditorTool(payload: OfficeSetEditorToolPayload): void {
    const prevTool = this.activeTool;
    this.activeTool = payload.tool;
    this.activeTileColor = payload.tileColor ?? "neutral";
    this.activeFurnitureId = payload.furnitureId;
    if (prevTool !== "furniture" || payload.tool !== "furniture") {
      this.furnitureRotationTurns = 0;
    }
    this.updateGhostMarker();
    this.refreshOverlay();
  }

  private onRKeyDown(): void {
    if (this.activeTool !== "furniture") return;
    this.furnitureRotationTurns = ((this.furnitureRotationTurns + 1) % 4) as 0 | 1 | 2 | 3;
    this.updateGhostMarker();
    this.refreshOverlay();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
      this.isPanning = true;
      this.panStartPointer.set(pointer.x, pointer.y);
      this.panStartScroll.set(this.cameras.main.scrollX, this.cameras.main.scrollY);
      return;
    }

    if (!pointer.leftButtonDown()) {
      return;
    }

    const pointerState = this.resolvePointerState(pointer);

    if (this.activeTool) {
      this.isPainting = true;
      this.applyTool(pointerState);
      return;
    }

    // No active tool: selection mode
    this.selectedCell = pointerState.cell;
    this.selectedTarget = pointerState.target;
    this.updateSelectionMarker();
    this.refreshOverlay(pointerState);
    this.game.events.emit(
      OFFICE_SELECTION_CHANGED_EVENT,
      {
        cell: this.selectedCell,
        target: this.toHoverTarget(pointerState.target),
      } satisfies OfficeSelectionChangedPayload,
    );
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 1 || pointer.button === 2) {
      this.isPanning = false;
    }
    if (pointer.button === 0) {
      this.isPainting = false;
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.isPanning) {
      const camera = this.cameras.main;
      const zoom = camera.zoom || 1;
      camera.scrollX = this.panStartScroll.x - (pointer.x - this.panStartPointer.x) / zoom;
      camera.scrollY = this.panStartScroll.y - (pointer.y - this.panStartPointer.y) / zoom;
      this.refreshOverlay();
      this.emitCameraChanged();
      return;
    }

    const pointerState = this.resolvePointerState(pointer);

    // Drag-paint when left button is held and a tool is active
    if (this.isPainting && this.activeTool && pointer.isDown) {
      this.applyTool(pointerState);
      return;
    }

    if (
      this.isSameCell(this.hoverCell, pointerState.cell) &&
      this.isSameTarget(this.hoverTarget, pointerState.target)
    ) {
      return;
    }

    this.hoverCell = pointerState.cell;
    this.hoverTarget = pointerState.target;
    this.updateHoverMarker();
    this.updateGhostMarker();
    this.refreshOverlay(pointerState);
    this.game.events.emit(
      OFFICE_POINTER_MOVED_EVENT,
      this.toPointerPayload(pointerState) satisfies OfficePointerMovedPayload,
    );
  }

  private onPointerWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    const zoomDelta = deltaY > 0 ? 0.9 : 1.1;
    this.setZoom(this.cameras.main.zoom * zoomDelta, pointer);
  }

  private onGameOut(): void {
    this.hoverCell = null;
    this.hoverTarget = null;
    this.isPainting = false;
    this.updateHoverMarker();
    this.updateGhostMarker();
    this.refreshOverlay();
    this.game.events.emit(
      OFFICE_POINTER_MOVED_EVENT,
      {
        cell: null,
        worldX: Number.NaN,
        worldY: Number.NaN,
        target: null,
      } satisfies OfficePointerMovedPayload,
    );
  }

  private onSetZoom(payload: SetZoomPayload): void {
    this.setZoom(payload.zoom, this.input.activePointer);
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
    this.refreshOverlay();
  }

  // ─── Tool application ────────────────────────────────────────────────────────

  private applyTool(pointerState: ResolvedPointerState): void {
    const { cell, target } = pointerState;

    switch (this.activeTool) {
      case "floor":
        if (cell) this.applyPaintTile(cell, "floor");
        break;
      case "wall":
        if (cell) this.applyPaintTile(cell, "wall");
        break;
      case "erase":
        if (target?.kind === "furniture") {
          this.applyRemoveFurniture(target.id);
        } else if (cell) {
          this.applyEraseTile(cell);
        }
        break;
      case "furniture":
        if (cell && this.activeFurnitureId) {
          this.applyPlaceFurniture(cell, this.activeFurnitureId);
        }
        break;
    }
  }

  private applyPaintTile(cell: OfficeSceneCellCoord, kind: "floor" | "wall"): void {
    const idx = cell.row * this.layout.cols + cell.col;
    const tile = this.layout.tiles[idx];
    if (!tile) return;

    const tint = TILE_COLOR_TINTS[this.activeTileColor] ?? TILE_COLOR_TINTS.neutral ?? 0x475569;
    const changed = tile.kind !== kind || (kind === "floor" && tile.tint !== tint);
    if (!changed) return;

    tile.kind = kind;
    if (kind === "floor") {
      tile.tint = tint;
    } else {
      delete tile.tint;
    }

    this.rerenderLayout();
  }

  private applyEraseTile(cell: OfficeSceneCellCoord): void {
    const idx = cell.row * this.layout.cols + cell.col;
    const tile = this.layout.tiles[idx];
    if (!tile || tile.kind === "void") return;

    tile.kind = "void";
    delete tile.tint;
    this.rerenderLayout();
  }

  private applyPlaceFurniture(cell: OfficeSceneCellCoord, furnitureId: string): void {
    const paletteItem = this.furniturePaletteMap.get(furnitureId);
    if (!paletteItem) return;

    const { effectiveW, effectiveH } = this.getEffectiveFootprint(paletteItem);

    // Don't place if it would go out of bounds
    if (
      cell.col + effectiveW > this.layout.cols ||
      cell.row + effectiveH > this.layout.rows
    ) {
      return;
    }

    const newFurniture: OfficeSceneFurniture = {
      id: `placed-${furnitureId}-${Date.now()}`,
      assetId: furnitureId,
      label: paletteItem.label,
      category: paletteItem.category as OfficeSceneFurnitureCategory,
      placement: paletteItem.placement,
      col: cell.col,
      row: cell.row,
      width: effectiveW,
      height: effectiveH,
      color: paletteItem.color,
      accentColor: paletteItem.accentColor,
    };

    this.layout.furniture.push(newFurniture);
    this.rerenderLayout();
  }

  private getEffectiveFootprint(item: FurniturePaletteItem): { effectiveW: number; effectiveH: number } {
    const swap = this.furnitureRotationTurns % 2 === 1;
    return {
      effectiveW: swap ? item.footprintH : item.footprintW,
      effectiveH: swap ? item.footprintW : item.footprintH,
    };
  }

  private applyRemoveFurniture(furnitureId: string): void {
    const idx = this.layout.furniture.findIndex((f) => f.id === furnitureId);
    if (idx === -1) return;

    this.layout.furniture.splice(idx, 1);
    this.rerenderLayout();
  }

  private rerenderLayout(): void {
    this.renderable?.destroy();
    this.renderable = renderOfficeLayout(this, this.layout);

    // Re-stack markers and overlay above the new render
    this.hoverMarker?.setDepth(20_000);
    this.selectionMarker?.setDepth(20_001);
    this.ghostMarker?.setDepth(20_002);
    this.overlayText?.setDepth(30_000);

    // Re-resolve hover/selection from current state
    this.updateHoverMarker();
    this.updateGhostMarker();
    this.updateSelectionMarker();
  }

  // ─── Markers ─────────────────────────────────────────────────────────────────

  private updateHoverMarker(): void {
    if (this.activeTool) {
      // In edit mode, ghost marker handles hover feedback; hide the regular hover marker
      this.hoverMarker?.setVisible(false);
      return;
    }
    this.updateMarker(this.hoverMarker, this.hoverCell, this.hoverTarget);
  }

  private updateGhostMarker(): void {
    const ghost = this.ghostMarker;
    if (!ghost) return;

    if (!this.activeTool || !this.hoverCell) {
      ghost.setVisible(false);
      this.ghostSprite?.setVisible(false);
      return;
    }

    let w = 1;
    let h = 1;

    if (this.activeTool === "furniture" && this.activeFurnitureId) {
      const item = this.furniturePaletteMap.get(this.activeFurnitureId);
      if (item) {
        const { effectiveW, effectiveH } = this.getEffectiveFootprint(item);
        w = effectiveW;
        h = effectiveH;
        this.updateGhostSprite(item, w, h);
      } else {
        this.ghostSprite?.setVisible(false);
      }
    } else {
      this.ghostSprite?.setVisible(false);
    }

    const { cellSize } = this.layout;
    ghost.setPosition(this.hoverCell.col * cellSize, this.hoverCell.row * cellSize);
    ghost.setSize(w * cellSize, h * cellSize);
    ghost.setVisible(true);
  }

  private updateGhostSprite(item: FurniturePaletteItem, effectiveW: number, effectiveH: number): void {
    if (!this.hoverCell) return;

    const { cellSize } = this.layout;
    const { atlasKey, atlasFrame } = item;

    if (!this.ghostSprite || this.ghostSpriteItemId !== item.id) {
      this.ghostSprite?.destroy();
      this.ghostSprite = this.add.image(0, 0, DONARG_OFFICE_FURNITURE_ATLAS_KEY, atlasKey);
      this.ghostSprite.setDepth(20_003);
      this.ghostSprite.setAlpha(0.75);
      this.ghostSpriteItemId = item.id;
    }

    // Scale sprite to its natural footprint then rotate so it fits the effective footprint
    this.ghostSprite.setScale(
      (item.footprintW * cellSize) / atlasFrame.w,
      (item.footprintH * cellSize) / atlasFrame.h,
    );
    this.ghostSprite.setAngle(this.furnitureRotationTurns * 90);

    // Center the sprite within the effective footprint area
    const cx = this.hoverCell.col * cellSize + (effectiveW * cellSize) / 2;
    const cy = this.hoverCell.row * cellSize + (effectiveH * cellSize) / 2;
    this.ghostSprite.setPosition(cx, cy);
    this.ghostSprite.setVisible(true);
  }

  private updateSelectionMarker(): void {
    if (this.activeTool) {
      this.selectionMarker?.setVisible(false);
      return;
    }
    this.updateMarker(this.selectionMarker, this.selectedCell, this.selectedTarget);
  }

  private updateMarker(
    marker: Phaser.GameObjects.Rectangle | null,
    cell: OfficeSceneCellCoord | null,
    target: OfficeRenderableTarget | null,
  ): void {
    if (!marker) {
      return;
    }

    const bounds = target?.bounds ?? this.getCellBounds(cell);
    if (!bounds) {
      marker.setVisible(false);
      return;
    }

    marker.setPosition(bounds.x, bounds.y);
    marker.setSize(bounds.width, bounds.height);
    marker.setVisible(true);
  }

  private getCellBounds(cell: OfficeSceneCellCoord | null): Phaser.Geom.Rectangle | null {
    if (!cell) {
      return null;
    }

    const { cellSize } = this.layout;
    return new Phaser.Geom.Rectangle(
      cell.col * cellSize,
      cell.row * cellSize,
      cellSize,
      cellSize,
    );
  }

  // ─── Overlay ─────────────────────────────────────────────────────────────────

  private refreshOverlay(pointerState: ResolvedPointerState | null = null): void {
    if (!this.overlayText) {
      return;
    }

    const hoverCell = pointerState?.cell ?? this.hoverCell;
    const hoverTarget = pointerState?.target ?? this.hoverTarget;
    const selectedTarget = this.selectedTarget;
    const camera = this.cameras.main;

    const hoverLabel = hoverCell
      ? `${hoverCell.col},${hoverCell.row}${
          hoverTarget ? ` ${hoverTarget.kind}:${hoverTarget.label}` : ""
        }`
      : "none";
    const selectedLabel = this.selectedCell
      ? `${this.selectedCell.col},${this.selectedCell.row}${
          selectedTarget ? ` ${selectedTarget.kind}:${selectedTarget.label}` : ""
        }`
      : "none";

    const furnitureSuffix =
      this.activeTool === "furniture" && this.activeFurnitureId
        ? ` (${this.activeFurnitureId}) rot:${this.furnitureRotationTurns * 90}°`
        : "";
    const toolLine = this.activeTool
      ? `tool ${this.activeTool}${this.activeTool === "floor" ? ` (${this.activeTileColor})` : ""}${furnitureSuffix}`
      : "tool none (select mode)";
    const hintLine =
      this.activeTool === "furniture"
        ? "left click place | R rotate | wheel zoom | middle/right drag pan"
        : this.activeTool
          ? "left click/drag paint | wheel zoom | middle/right drag pan"
          : "left click select | wheel zoom | middle/right drag pan";

    this.overlayText.setText(
      [
        "Donarg Office",
        `zoom ${camera.zoom.toFixed(2)} scroll ${camera.scrollX.toFixed(0)},${camera.scrollY.toFixed(0)}`,
        `hover ${hoverLabel}`,
        this.activeTool ? `ghost ${toolLine}` : `selected ${selectedLabel}`,
        hintLine,
      ].join("\n"),
    );
  }

  // ─── Zoom ────────────────────────────────────────────────────────────────────

  private setZoom(nextZoom: number, pointer: Phaser.Input.Pointer): void {
    const camera = this.cameras.main;
    const clampedZoom = Phaser.Math.Clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);

    if (Math.abs(camera.zoom - clampedZoom) < Number.EPSILON) {
      return;
    }

    const worldPointBefore = camera.getWorldPoint(pointer.x, pointer.y);
    camera.setZoom(clampedZoom);
    const worldPointAfter = camera.getWorldPoint(pointer.x, pointer.y);

    camera.scrollX += worldPointBefore.x - worldPointAfter.x;
    camera.scrollY += worldPointBefore.y - worldPointAfter.y;

    this.updateHoverMarker();
    this.updateGhostMarker();
    this.updateSelectionMarker();
    this.refreshOverlay();
    this.emitZoomChanged();
    this.emitCameraChanged();
  }

  private emitZoomChanged(): void {
    this.game.events.emit(ZOOM_CHANGED_EVENT, {
      zoom: this.cameras.main.zoom,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
  }

  private emitCameraChanged(): void {
    this.game.events.emit(OFFICE_CAMERA_CHANGED_EVENT, {
      zoom: this.cameras.main.zoom,
      scrollX: this.cameras.main.scrollX,
      scrollY: this.cameras.main.scrollY,
    });
  }

  // ─── Pointer state ───────────────────────────────────────────────────────────

  private resolvePointerState(pointer: Phaser.Input.Pointer): ResolvedPointerState {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell = this.worldToCell(worldPoint.x, worldPoint.y);
    const target = this.findHoverTarget(worldPoint.x, worldPoint.y);

    return {
      cell,
      worldX: worldPoint.x,
      worldY: worldPoint.y,
      target,
    };
  }

  private worldToCell(worldX: number, worldY: number): OfficeSceneCellCoord | null {
    const { cellSize, cols, rows } = this.layout;
    const col = Math.floor(worldX / cellSize);
    const row = Math.floor(worldY / cellSize);

    if (col < 0 || row < 0 || col >= cols || row >= rows) {
      return null;
    }

    return { col, row };
  }

  private findHoverTarget(worldX: number, worldY: number): OfficeRenderableTarget | null {
    for (const actor of this.renderIndex.characters) {
      if (actor.bounds.contains(worldX, worldY)) {
        return actor;
      }
    }

    for (const item of this.renderIndex.furniture) {
      if (item.bounds.contains(worldX, worldY)) {
        return item;
      }
    }

    return null;
  }

  private toPointerPayload(pointerState: ResolvedPointerState): OfficePointerMovedPayload {
    return {
      cell: pointerState.cell,
      worldX: pointerState.worldX,
      worldY: pointerState.worldY,
      target: this.toHoverTarget(pointerState.target),
    };
  }

  private toHoverTarget(target: OfficeRenderableTarget | null): OfficeSceneHoverTarget {
    if (!target) {
      return null;
    }

    return {
      kind: target.kind,
      id: target.id,
      label: target.label,
    };
  }

  private isSameCell(
    left: OfficeSceneCellCoord | null,
    right: OfficeSceneCellCoord | null,
  ): boolean {
    return left?.col === right?.col && left?.row === right?.row;
  }

  private isSameTarget(
    left: OfficeRenderableTarget | null,
    right: OfficeRenderableTarget | null,
  ): boolean {
    return left?.kind === right?.kind && left?.id === right?.id;
  }
}

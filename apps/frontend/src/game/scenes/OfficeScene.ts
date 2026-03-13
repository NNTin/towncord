import Phaser from "phaser";
import { SET_ZOOM_EVENT, ZOOM_CHANGED_EVENT, type SetZoomPayload } from "../events";
import {
  createOfficeSceneBootstrap,
  getOfficeSceneBootstrap,
  OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY,
  type OfficeSceneBootstrap,
  type OfficeSceneCharacter,
  type OfficeSceneFurniture,
  type OfficeSceneLayout,
  type OfficeSceneTile,
} from "./office/bootstrap";
import { resolveOfficeTileFill } from "./office/colors";
import {
  OFFICE_CAMERA_CHANGED_EVENT,
  OFFICE_POINTER_MOVED_EVENT,
  OFFICE_SELECTION_CHANGED_EVENT,
  type OfficePointerMovedPayload,
  type OfficeSceneCellCoord,
  type OfficeSceneHoverTarget,
  type OfficeSelectionChangedPayload,
} from "./office/events";

export const OFFICE_SCENE_KEY = "office";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const CAMERA_PADDING = 96;
const GRID_LINE_COLOR = 0x1f2937;
const VOID_TILE_COLOR = 0x020617;
const HOVER_STROKE_COLOR = 0x38bdf8;
const SELECTED_STROKE_COLOR = 0xf59e0b;

export class OfficeScene extends Phaser.Scene {
  private bootstrap: OfficeSceneBootstrap = createOfficeSceneBootstrap();

  private layout: OfficeSceneLayout = this.bootstrap.layout;

  private hoverCell: OfficeSceneCellCoord | null = null;

  private selectedCell: OfficeSceneCellCoord | null = null;

  private hoverMarker: Phaser.GameObjects.Rectangle | null = null;

  private selectionMarker: Phaser.GameObjects.Rectangle | null = null;

  private overlayText: Phaser.GameObjects.Text | null = null;

  private isPanning = false;

  private panStartPointer = new Phaser.Math.Vector2();

  private panStartScroll = new Phaser.Math.Vector2();

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

    this.renderLayout();
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
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  private onShutdown(): void {
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onPointerWheel, this);
    this.input.off(Phaser.Input.Events.GAME_OUT, this.onGameOut, this);
    this.game.events.off(SET_ZOOM_EVENT, this.onSetZoom, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
  }

  private renderLayout(): void {
    const graphics = this.add.graphics();
    const { cols, rows, cellSize, tiles, furniture, characters } = this.layout;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const tile = tiles[this.getTileIndex(col, row)] ?? { kind: "void" satisfies OfficeSceneTile["kind"] };
        const x = col * cellSize;
        const y = row * cellSize;
        const fill = tile.kind === "void" ? VOID_TILE_COLOR : resolveOfficeTileFill(tile.kind, tile.tint);
        const alpha = tile.kind === "void" ? 0.45 : 1;

        graphics.fillStyle(fill, alpha);
        graphics.fillRect(x, y, cellSize, cellSize);
        graphics.lineStyle(1, GRID_LINE_COLOR, tile.kind === "void" ? 0.25 : 0.75);
        graphics.strokeRect(x, y, cellSize, cellSize);
      }
    }

    for (const item of furniture) {
      this.renderFurniture(item);
    }

    for (const actor of characters) {
      this.renderCharacter(actor);
    }
  }

  private renderFurniture(item: OfficeSceneFurniture): void {
    const { cellSize } = this.layout;
    const x = item.col * cellSize;
    const y = item.row * cellSize;
    const width = item.width * cellSize;
    const height = item.height * cellSize;
    const rect = this.add.rectangle(x, y, width, height, item.color, 0.95);
    rect.setOrigin(0);
    rect.setStrokeStyle(2, 0xfef3c7, 0.9);
    rect.setDepth(100 + item.row * 10 + item.height);

    const label = this.add.text(x + width / 2, y + height / 2, item.label, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#f8fafc",
    });
    label.setOrigin(0.5);
    label.setDepth(rect.depth + 1);
  }

  private renderCharacter(actor: OfficeSceneCharacter): void {
    const { cellSize } = this.layout;
    const x = actor.col * cellSize + cellSize / 2;
    const y = actor.row * cellSize + cellSize / 2;
    const circle = this.add.circle(x, y, cellSize * 0.26, actor.color, 1);
    circle.setStrokeStyle(2, 0xe2e8f0, 0.95);
    circle.setDepth(400 + actor.row * 10);

    const label = this.add.text(x, y - 1, actor.label, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#020617",
    });
    label.setOrigin(0.5);
    label.setDepth(circle.depth + 1);
  }

  private createMarkers(): void {
    const { cellSize } = this.layout;

    this.hoverMarker = this.add.rectangle(0, 0, cellSize, cellSize);
    this.hoverMarker.setOrigin(0);
    this.hoverMarker.setFillStyle(HOVER_STROKE_COLOR, 0.12);
    this.hoverMarker.setStrokeStyle(2, HOVER_STROKE_COLOR, 0.95);
    this.hoverMarker.setVisible(false);
    this.hoverMarker.setDepth(1_000);

    this.selectionMarker = this.add.rectangle(0, 0, cellSize, cellSize);
    this.selectionMarker.setOrigin(0);
    this.selectionMarker.setFillStyle(SELECTED_STROKE_COLOR, 0.12);
    this.selectionMarker.setStrokeStyle(2, SELECTED_STROKE_COLOR, 1);
    this.selectionMarker.setVisible(false);
    this.selectionMarker.setDepth(1_001);
  }

  private createOverlay(): void {
    this.overlayText = this.add.text(16, 16, "", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#e2e8f0",
      backgroundColor: "rgba(2, 6, 23, 0.7)",
      padding: {
        x: 10,
        y: 8,
      },
    });
    this.overlayText.setDepth(10_000);
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

    const payload = this.getPointerPayload(pointer);
    this.selectedCell = payload.cell;
    this.updateSelectionMarker();
    this.refreshOverlay();
    this.game.events.emit(
      OFFICE_SELECTION_CHANGED_EVENT,
      {
        cell: this.selectedCell,
        target: payload.target,
      } satisfies OfficeSelectionChangedPayload,
    );
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 1 || pointer.button === 2) {
      this.isPanning = false;
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

    const payload = this.getPointerPayload(pointer);
    const nextHover = payload.cell;
    if (this.isSameCell(this.hoverCell, nextHover)) {
      return;
    }

    this.hoverCell = nextHover;
    this.updateHoverMarker();
    this.refreshOverlay(payload);
    this.game.events.emit(OFFICE_POINTER_MOVED_EVENT, payload satisfies OfficePointerMovedPayload);
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
    this.updateHoverMarker();
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
  }

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

  private getPointerPayload(pointer: Phaser.Input.Pointer): OfficePointerMovedPayload {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell = this.worldToCell(worldPoint.x, worldPoint.y);
    const target = this.findHoverTarget(cell);

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

  private findHoverTarget(cell: OfficeSceneCellCoord | null): OfficeSceneHoverTarget {
    if (!cell) {
      return null;
    }

    for (const actor of this.layout.characters) {
      if (actor.col === cell.col && actor.row === cell.row) {
        return {
          kind: "character",
          id: actor.id,
          label: actor.label,
        };
      }
    }

    for (const item of this.layout.furniture) {
      if (
        cell.col >= item.col &&
        cell.col < item.col + item.width &&
        cell.row >= item.row &&
        cell.row < item.row + item.height
      ) {
        return {
          kind: "furniture",
          id: item.id,
          label: item.label,
        };
      }
    }

    return null;
  }

  private updateHoverMarker(): void {
    if (!this.hoverMarker || !this.hoverCell) {
      this.hoverMarker?.setVisible(false);
      return;
    }

    const { cellSize } = this.layout;
    this.hoverMarker.setPosition(this.hoverCell.col * cellSize, this.hoverCell.row * cellSize);
    this.hoverMarker.setVisible(true);
  }

  private updateSelectionMarker(): void {
    if (!this.selectionMarker || !this.selectedCell) {
      this.selectionMarker?.setVisible(false);
      return;
    }

    const { cellSize } = this.layout;
    this.selectionMarker.setPosition(
      this.selectedCell.col * cellSize,
      this.selectedCell.row * cellSize,
    );
    this.selectionMarker.setVisible(true);
  }

  private refreshOverlay(payload: OfficePointerMovedPayload | null = null): void {
    if (!this.overlayText) {
      return;
    }

    const hoverCell = payload?.cell ?? this.hoverCell;
    const hoverTarget = payload?.target ?? this.findHoverTarget(this.hoverCell);
    const selectedTarget = this.findHoverTarget(this.selectedCell);
    const camera = this.cameras.main;

    const hoverLabel = hoverCell
      ? `${hoverCell.col},${hoverCell.row}${hoverTarget ? ` ${hoverTarget.kind}:${hoverTarget.label}` : ""}`
      : "none";
    const selectedLabel = this.selectedCell
      ? `${this.selectedCell.col},${this.selectedCell.row}${
          selectedTarget ? ` ${selectedTarget.kind}:${selectedTarget.label}` : ""
        }`
      : "none";

    this.overlayText.setText(
      [
        "Office Scene Scaffold",
        `zoom ${camera.zoom.toFixed(2)} scroll ${camera.scrollX.toFixed(0)},${camera.scrollY.toFixed(0)}`,
        `hover ${hoverLabel}`,
        `selected ${selectedLabel}`,
        "left click select | wheel zoom | middle/right drag pan",
      ].join("\n"),
    );
  }

  private getTileIndex(col: number, row: number): number {
    return row * this.layout.cols + col;
  }

  private isSameCell(
    left: OfficeSceneCellCoord | null,
    right: OfficeSceneCellCoord | null,
  ): boolean {
    return left?.col === right?.col && left?.row === right?.row;
  }
}

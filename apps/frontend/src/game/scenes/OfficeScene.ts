import Phaser from "phaser";
import { SET_ZOOM_EVENT, ZOOM_CHANGED_EVENT, type SetZoomPayload } from "../events";
import {
  createOfficeSceneBootstrap,
  getOfficeSceneBootstrap,
  OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY,
  type OfficeSceneBootstrap,
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
  type OfficeRenderableTarget,
  type OfficeSceneRenderIndex,
} from "./office/render";

export const OFFICE_SCENE_KEY = "office";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const CAMERA_PADDING = 96;
const HOVER_STROKE_COLOR = 0x38bdf8;
const SELECTED_STROKE_COLOR = 0xf59e0b;

type ResolvedPointerState = {
  cell: OfficeSceneCellCoord | null;
  worldX: number;
  worldY: number;
  target: OfficeRenderableTarget | null;
};

export class OfficeScene extends Phaser.Scene {
  private bootstrap: OfficeSceneBootstrap = createOfficeSceneBootstrap();

  private layout: OfficeSceneLayout = this.bootstrap.layout;

  private renderIndex: OfficeSceneRenderIndex = {
    furniture: [],
    characters: [],
  };

  private hoverCell: OfficeSceneCellCoord | null = null;

  private hoverTarget: OfficeRenderableTarget | null = null;

  private selectedCell: OfficeSceneCellCoord | null = null;

  private selectedTarget: OfficeRenderableTarget | null = null;

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

    this.renderIndex = renderOfficeLayout(this, this.layout);
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
    if (
      this.isSameCell(this.hoverCell, pointerState.cell) &&
      this.isSameTarget(this.hoverTarget, pointerState.target)
    ) {
      return;
    }

    this.hoverCell = pointerState.cell;
    this.hoverTarget = pointerState.target;
    this.updateHoverMarker();
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
    this.refreshOverlay();
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

  private updateHoverMarker(): void {
    this.updateMarker(this.hoverMarker, this.hoverCell, this.hoverTarget);
  }

  private updateSelectionMarker(): void {
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

    this.overlayText.setText(
      [
        "Donarg Office",
        `zoom ${camera.zoom.toFixed(2)} scroll ${camera.scrollX.toFixed(0)},${camera.scrollY.toFixed(0)}`,
        `hover ${hoverLabel}`,
        `selected ${selectedLabel}`,
        "left click select | wheel zoom | middle/right drag pan",
      ].join("\n"),
    );
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

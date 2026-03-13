import Phaser from "phaser";
import {
  getOfficeCharacters,
  getOfficeTileIndex,
  type OfficeCellCoord,
  type OfficeLayoutDocument,
} from "../office";
import {
  SET_ZOOM_EVENT,
  ZOOM_CHANGED_EVENT,
  type SetZoomPayload,
} from "../events";
import {
  createOfficeSceneBootstrap,
  getOfficeSceneBootstrap,
  OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY,
} from "./office/bootstrap";
import { resolveOfficeTileFill } from "./office/colors";

export const OFFICE_SCENE_KEY = "office";

const CELL_SIZE = 40;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3;
const BG_COLOR = 0x0b1220;

export class OfficeScene extends Phaser.Scene {
  private layout: OfficeLayoutDocument = createOfficeSceneBootstrap().layout;
  private hoverCell: OfficeCellCoord | null = null;
  private selectedCell: OfficeCellCoord | null = null;
  private hoverRect: Phaser.GameObjects.Rectangle | null = null;
  private selectionRect: Phaser.GameObjects.Rectangle | null = null;
  private infoText: Phaser.GameObjects.Text | null = null;
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private camStartX = 0;
  private camStartY = 0;

  constructor() {
    super(OFFICE_SCENE_KEY);
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    const bootstrap =
      getOfficeSceneBootstrap(this.registry.get(OFFICE_SCENE_BOOTSTRAP_REGISTRY_KEY)) ??
      createOfficeSceneBootstrap();
    this.layout = bootstrap.layout;

    this.renderLayout();
    this.createChrome();
    this.bindSceneEvents();
    this.emitZoomChanged();
  }

  private bindSceneEvents(): void {
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.input.on("pointerupoutside", this.onPointerUp, this);
    this.input.on("wheel", this.onWheel, this);
    this.game.events.on(SET_ZOOM_EVENT, this.onSetZoom, this);
    this.events.once("shutdown", this.handleShutdown, this);
  }

  private handleShutdown(): void {
    this.game.events.off(SET_ZOOM_EVENT, this.onSetZoom, this);
    this.input.off("pointerdown", this.onPointerDown, this);
    this.input.off("pointermove", this.onPointerMove, this);
    this.input.off("pointerup", this.onPointerUp, this);
    this.input.off("pointerupoutside", this.onPointerUp, this);
    this.input.off("wheel", this.onWheel, this);
  }

  private renderLayout(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(BG_COLOR, 1);
    graphics.fillRect(0, 0, this.layout.cols * CELL_SIZE, this.layout.rows * CELL_SIZE);

    for (let row = 0; row < this.layout.rows; row += 1) {
      for (let col = 0; col < this.layout.cols; col += 1) {
        const index = getOfficeTileIndex(this.layout, col, row);
        if (index === null) {
          continue;
        }

        const tile = this.layout.tiles[index]!;
        const tint = this.layout.tileColors?.[index] ?? null;
        graphics.fillStyle(resolveOfficeTileFill(tile, tint), 1);
        graphics.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
      }
    }

    for (const furniture of this.layout.furniture) {
      const x = furniture.col * CELL_SIZE + 4;
      const y = furniture.row * CELL_SIZE + 4;
      const width = CELL_SIZE * 2 - 8;
      const height = CELL_SIZE * 2 - 8;
      graphics.fillStyle(0x8b5e34, 0.95);
      graphics.fillRoundedRect(x, y, width, height, 6);
      this.add.text(x + 8, y + 10, furniture.uid, {
        color: "#f8fafc",
        fontFamily: "monospace",
        fontSize: "10px",
      });
    }

    for (const character of getOfficeCharacters(this.layout)) {
      const centerX = character.col * CELL_SIZE + CELL_SIZE * 0.5;
      const centerY = character.row * CELL_SIZE + CELL_SIZE * 0.5;
      const fill = character.paletteVariant === "palette-1" ? 0x7dd3fc : 0xfbbf24;
      this.add.circle(centerX, centerY, 12, fill, 1);
      this.add.text(centerX - 10, centerY - 5, character.pose.slice(0, 1).toUpperCase(), {
        color: "#0f172a",
        fontFamily: "monospace",
        fontSize: "10px",
      });
    }
  }

  private createChrome(): void {
    this.hoverRect = this.add.rectangle(0, 0, CELL_SIZE, CELL_SIZE);
    this.hoverRect
      .setOrigin(0, 0)
      .setFillStyle(0xffffff, 0.08)
      .setStrokeStyle(1, 0xffffff, 0.45)
      .setVisible(false);

    this.selectionRect = this.add.rectangle(0, 0, CELL_SIZE, CELL_SIZE);
    this.selectionRect
      .setOrigin(0, 0)
      .setFillStyle(0x60a5fa, 0.12)
      .setStrokeStyle(2, 0x93c5fd, 0.95)
      .setVisible(false);

    this.infoText = this.add
      .text(16, 16, "OfficeScene scaffold active", {
        color: "#e2e8f0",
        fontFamily: "monospace",
        fontSize: "12px",
        backgroundColor: "#0f172a",
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 1) {
      this.isPanning = true;
      this.panStartX = pointer.x;
      this.panStartY = pointer.y;
      this.camStartX = this.cameras.main.scrollX;
      this.camStartY = this.cameras.main.scrollY;
      return;
    }

    if (pointer.button !== 0) {
      return;
    }

    const cell = this.screenToCell(pointer.x, pointer.y);
    if (!cell) {
      return;
    }

    this.selectedCell = cell;
    this.selectionRect?.setPosition(cell.col * CELL_SIZE, cell.row * CELL_SIZE).setVisible(true);
    this.syncInfoText();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.isPanning) {
      const zoom = this.cameras.main.zoom;
      const dx = (pointer.x - this.panStartX) / zoom;
      const dy = (pointer.y - this.panStartY) / zoom;
      this.cameras.main.setScroll(this.camStartX - dx, this.camStartY - dy);
      return;
    }

    this.hoverCell = this.screenToCell(pointer.x, pointer.y);
    if (!this.hoverCell) {
      this.hoverRect?.setVisible(false);
      this.syncInfoText();
      return;
    }

    this.hoverRect
      ?.setPosition(this.hoverCell.col * CELL_SIZE, this.hoverCell.row * CELL_SIZE)
      .setVisible(true);
    this.syncInfoText();
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.button === 1) {
      this.isPanning = false;
    }
  }

  private onWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: unknown,
    _dx: number,
    dy: number,
  ): void {
    const factor = dy > 0 ? 0.9 : 1.1;
    this.setZoom(this.cameras.main.zoom * factor);
  }

  private onSetZoom(payload: SetZoomPayload): void {
    this.setZoom(payload.zoom);
  }

  private setZoom(nextZoom: number): void {
    this.cameras.main.setZoom(Phaser.Math.Clamp(nextZoom, MIN_ZOOM, MAX_ZOOM));
    this.emitZoomChanged();
  }

  private emitZoomChanged(): void {
    this.game.events.emit(ZOOM_CHANGED_EVENT, {
      zoom: this.cameras.main.zoom,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
  }

  private syncInfoText(): void {
    if (!this.infoText) {
      return;
    }

    const hover = this.hoverCell ? `hover ${this.hoverCell.col},${this.hoverCell.row}` : "hover --";
    const selected = this.selectedCell
      ? `selected ${this.selectedCell.col},${this.selectedCell.row}`
      : "selected --";

    this.infoText.setText([
      "OfficeScene scaffold active",
      hover,
      selected,
      `zoom ${this.cameras.main.zoom.toFixed(2)}`,
      "wheel = zoom, middle mouse = pan",
    ]);
  }

  private screenToCell(screenX: number, screenY: number): OfficeCellCoord | null {
    const worldPoint = this.cameras.main.getWorldPoint(screenX, screenY);
    const col = Math.floor(worldPoint.x / CELL_SIZE);
    const row = Math.floor(worldPoint.y / CELL_SIZE);
    if (getOfficeTileIndex(this.layout, col, row) === null) {
      return null;
    }

    return { col, row };
  }
}

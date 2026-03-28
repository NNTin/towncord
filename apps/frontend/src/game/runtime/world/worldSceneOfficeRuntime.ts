import type Phaser from "phaser";
import type { OfficeSceneBootstrap } from "../../contracts/office-scene";
import { RENDER_LAYERS } from "../../renderLayers";
import {
  WORLD_REGION_BASE_PX,
  anchoredGridCellToWorldPixel,
  type AnchoredGridRegion,
  renderOfficeLayout,
  type OfficeLayoutRenderable,
} from "../../../engine";
import type {
  OfficeFloorMode,
  OfficeSelectionActionPayload,
  OfficeSelectedPlaceablePayload,
  OfficeSetEditorToolPayload,
} from "../../contracts/office-editor";
import { WorldSceneOfficeEditorController } from "./worldSceneOfficeEditorController";
import type { WorldSceneProjectionEmitter } from "./worldSceneProjections";
import type { OfficeFurniturePlacementPreview } from "./officeEditorSystem";

const OFFICE_CELL_HIGHLIGHT_FILL = 0x38bdf8;
const OFFICE_CELL_HIGHLIGHT_ALPHA = 0.22;
const OFFICE_CELL_HIGHLIGHT_STROKE_WIDTH = 2;
const OFFICE_CELL_HIGHLIGHT_STROKE = 0xe0f2fe;
const OFFICE_SELECTION_HIGHLIGHT_FILL = 0xf59e0b;
const OFFICE_SELECTION_HIGHLIGHT_ALPHA = 0.08;
const OFFICE_SELECTION_HIGHLIGHT_STROKE_WIDTH = 2;
const OFFICE_SELECTION_HIGHLIGHT_STROKE = 0xfbbf24;
const OFFICE_PREVIEW_TEXTURE_KEY = "donarg.office.furniture";
const OFFICE_PREVIEW_GHOST_ALPHA = 0.58;
const OFFICE_PREVIEW_FOOTPRINT_ALPHA = 0.18;
const OFFICE_PREVIEW_FOOTPRINT_STROKE_WIDTH = 2;
const OFFICE_PREVIEW_PLACE_FILL = 0x38bdf8;
const OFFICE_PREVIEW_PLACE_STROKE = 0xe0f2fe;
const OFFICE_PREVIEW_REPLACE_FILL = 0xf59e0b;
const OFFICE_PREVIEW_REPLACE_STROKE = 0xfcd34d;
const OFFICE_PREVIEW_BLOCKED_FILL = 0xef4444;
const OFFICE_PREVIEW_BLOCKED_STROKE = 0xfecaca;
const OFFICE_PREVIEW_FOOTPRINT_DEPTH = RENDER_LAYERS.OFFICE_CELL_HIGHLIGHT + 2;
const OFFICE_PREVIEW_GHOST_DEPTH = RENDER_LAYERS.OFFICE_CELL_HIGHLIGHT + 3;
const OFFICE_PREVIEW_LABEL_DEPTH = RENDER_LAYERS.OFFICE_CELL_HIGHLIGHT + 4;

type OfficeRegion = AnchoredGridRegion<OfficeSceneBootstrap["layout"]>;

type OfficePreviewVisualColors = {
  fill: number;
  stroke: number;
};

type WorldSceneOfficeRuntimeHost = {
  scene: Phaser.Scene;
  getActivePointer: () => Phaser.Input.Pointer | null;
  getWorldPoint: (screenX: number, screenY: number) => { x: number; y: number };
};

export class WorldSceneOfficeRuntime {
  private readonly controller: WorldSceneOfficeEditorController;
  private officeRenderable: OfficeLayoutRenderable | null = null;
  private officeRegion: OfficeRegion | null = null;
  private officeCellHighlight: Phaser.GameObjects.Rectangle | null = null;
  private officeSelectionHighlight: Phaser.GameObjects.Rectangle | null = null;
  private officePlacementPreviewGhost: Phaser.GameObjects.Image | null = null;
  private officePlacementPreviewCells: Phaser.GameObjects.Rectangle[] = [];
  private officePlacementPreviewLabel: Phaser.GameObjects.Text | null = null;

  constructor(
    private readonly host: WorldSceneOfficeRuntimeHost,
    private readonly projections: WorldSceneProjectionEmitter,
  ) {
    this.controller = new WorldSceneOfficeEditorController({
      getOfficeRegion: () => this.officeRegion,
      getOfficeCellHighlight: () => this.officeCellHighlight,
      getOfficeFurnitureTargets: () =>
        this.officeRenderable?.renderIndex.furniture ?? [],
      getActivePointer: this.host.getActivePointer,
      getWorldPoint: this.host.getWorldPoint,
      emitOfficeFloorPicked: (payload) =>
        this.projections.emitOfficeFloorPicked(payload),
    });
  }

  public bootstrap(bootstrap: OfficeSceneBootstrap): OfficeRegion {
    const { anchor, layout } = bootstrap;
    const officeRegion: OfficeRegion = {
      anchorX16: anchor.x,
      anchorY16: anchor.y,
      layout,
    };
    this.officeRegion = officeRegion;
    this.officeRenderable = renderOfficeLayout(
      this.host.scene,
      officeRegion.layout,
      {
        worldOffsetX: officeRegion.anchorX16 * WORLD_REGION_BASE_PX,
        worldOffsetY: officeRegion.anchorY16 * WORLD_REGION_BASE_PX,
        tileDepth: RENDER_LAYERS.OFFICE_FLOOR,
      },
    );
    this.createOfficeCellHighlight(officeRegion.layout.cellSize);
    this.createOfficeSelectionHighlight(officeRegion.layout.cellSize);
    this.syncSelectionHighlight();
    this.syncHighlight(this.host.getActivePointer());
    this.emitSelectionChanged();
    return officeRegion;
  }

  public getRegion(): OfficeRegion | null {
    return this.officeRegion;
  }

  public getOfficeFloorMode(): OfficeFloorMode {
    return this.controller.getOfficeFloorMode();
  }

  public getSelectedFurnitureId(): string | null {
    return this.controller.getSelectedFurnitureId();
  }

  public handleSetEditorTool(payload: OfficeSetEditorToolPayload): void {
    this.controller.setOfficeEditorTool(payload);
    this.syncSelectionHighlight();
    this.syncHighlight(this.host.getActivePointer());
    this.emitSelectionChanged();
  }

  public tryHandlePointerDown(pointer: Phaser.Input.Pointer): boolean {
    const handled = this.controller.tryHandlePointerDown(pointer);
    if (handled) {
      this.syncSelectionHighlight();
      this.emitSelectionChanged();
    }
    return handled;
  }

  public tryHandleSecondaryPointerDown(pointer: Phaser.Input.Pointer): boolean {
    const handled = this.controller.tryHandleSecondaryPointerDown(pointer);
    if (handled) {
      this.syncSelectionHighlight();
      this.emitSelectionChanged();
    }
    return handled;
  }

  public shouldContinuePainting(pointer: Phaser.Input.Pointer): boolean {
    return this.controller.shouldContinuePainting(pointer);
  }

  public continuePainting(pointer: Phaser.Input.Pointer): void {
    this.controller.continuePainting(pointer);
  }

  public endPainting(): void {
    this.controller.endPainting();
  }

  public rotateSelectedFurniture(): boolean {
    const changed = this.controller.rotateSelectedFurniture();
    if (changed) {
      this.rerenderOffice();
      this.syncSelectionHighlight();
      this.syncHighlight(this.host.getActivePointer());
      if (this.officeRegion) {
        this.projections.emitOfficeLayoutChanged({
          layout: this.officeRegion.layout,
        });
      }
      this.controller.consumePendingLayoutChange();
      this.emitSelectionChanged();
    }

    return changed;
  }

  public deleteSelectedFurniture(): boolean {
    const changed = this.controller.deleteSelectedFurniture();
    if (changed) {
      this.rerenderOffice();
      this.syncSelectionHighlight();
      this.syncHighlight(this.host.getActivePointer());
      if (this.officeRegion) {
        this.projections.emitOfficeLayoutChanged({
          layout: this.officeRegion.layout,
        });
      }
      this.controller.consumePendingLayoutChange();
      this.emitSelectionChanged();
    }

    return changed;
  }

  public handleSelectionAction(payload: OfficeSelectionActionPayload): void {
    switch (payload.action) {
      case "rotate":
        this.rotateSelectedFurniture();
        return;
      case "delete":
        this.deleteSelectedFurniture();
        return;
      default:
        return;
    }
  }

  public syncHighlight(pointer: Phaser.Input.Pointer | null): void {
    this.controller.syncOfficeCellHighlight(pointer);
    this.syncPlacementPreview(pointer);
  }

  public update(): void {
    if (!this.controller.consumePendingLayoutChange()) {
      return;
    }

    this.rerenderOffice();
    this.syncSelectionHighlight();
    this.syncHighlight(this.host.getActivePointer());
    if (this.officeRegion) {
      this.projections.emitOfficeLayoutChanged({
        layout: this.officeRegion.layout,
      });
    }
    this.emitSelectionChanged();
  }

  public dispose(): void {
    this.controller.reset();
    this.officeRenderable?.destroy();
    this.officeRenderable = null;
    this.officeCellHighlight?.destroy();
    this.officeCellHighlight = null;
    this.officeSelectionHighlight?.destroy();
    this.officeSelectionHighlight = null;
    this.officePlacementPreviewGhost?.destroy();
    this.officePlacementPreviewGhost = null;
    this.officePlacementPreviewLabel?.destroy();
    this.officePlacementPreviewLabel = null;
    for (const cell of this.officePlacementPreviewCells) {
      cell.destroy();
    }
    this.officePlacementPreviewCells = [];
    this.officeRegion = null;
  }

  private createOfficeCellHighlight(cellSize: number): void {
    this.officeCellHighlight?.destroy();

    const highlight = this.host.scene.add.rectangle(
      0,
      0,
      cellSize,
      cellSize,
      OFFICE_CELL_HIGHLIGHT_FILL,
      OFFICE_CELL_HIGHLIGHT_ALPHA,
    );
    highlight.setOrigin(0, 0);
    highlight.setDepth(RENDER_LAYERS.OFFICE_CELL_HIGHLIGHT);
    highlight.setStrokeStyle(
      OFFICE_CELL_HIGHLIGHT_STROKE_WIDTH,
      OFFICE_CELL_HIGHLIGHT_STROKE,
      0.9,
    );
    highlight.setVisible(false);
    this.officeCellHighlight = highlight;
  }

  private createOfficeSelectionHighlight(cellSize: number): void {
    this.officeSelectionHighlight?.destroy();

    const highlight = this.host.scene.add.rectangle(
      0,
      0,
      cellSize,
      cellSize,
      OFFICE_SELECTION_HIGHLIGHT_FILL,
      OFFICE_SELECTION_HIGHLIGHT_ALPHA,
    );
    highlight.setOrigin(0, 0);
    highlight.setDepth(RENDER_LAYERS.OFFICE_CELL_HIGHLIGHT + 1);
    highlight.setStrokeStyle(
      OFFICE_SELECTION_HIGHLIGHT_STROKE_WIDTH,
      OFFICE_SELECTION_HIGHLIGHT_STROKE,
      1,
    );
    highlight.setVisible(false);
    this.officeSelectionHighlight = highlight;
  }

  private syncSelectionHighlight(): void {
    const highlight = this.officeSelectionHighlight;
    const officeRenderable = this.officeRenderable;
    const selectedFurniture = this.resolveSelectedFurniture();

    if (!highlight || !officeRenderable || !selectedFurniture) {
      highlight?.setVisible(false);
      return;
    }

    const target = officeRenderable.renderIndex.furniture.find(
      (furniture) => furniture.id === selectedFurniture.id,
    );
    if (!target) {
      highlight.setVisible(false);
      return;
    }

    highlight.setPosition(target.bounds.x, target.bounds.y);
    highlight.setSize(target.bounds.width, target.bounds.height);
    highlight.setVisible(true);
  }

  private resolveSelectedFurniture() {
    const region = this.officeRegion;
    const selectedFurnitureId = this.controller.getSelectedFurnitureId();
    if (!region || !selectedFurnitureId) {
      return null;
    }

    const selectedFurniture =
      region.layout.furniture.find(
        (furniture) => furniture.id === selectedFurnitureId,
      ) ?? null;
    if (!selectedFurniture) {
      this.controller.clearSelectedFurniture();
      return null;
    }

    return selectedFurniture;
  }

  private emitSelectionChanged(): void {
    this.projections.emitOfficeSelectionChanged({
      selection: this.buildSelectedPlaceablePayload(),
    });
  }

  private buildSelectedPlaceablePayload(): OfficeSelectedPlaceablePayload | null {
    const selectedFurniture = this.resolveSelectedFurniture();
    if (!selectedFurniture) {
      return null;
    }

    return {
      kind: "furniture",
      id: selectedFurniture.id,
      assetId: selectedFurniture.assetId,
      label: selectedFurniture.label,
      category: selectedFurniture.category,
      placement: selectedFurniture.placement,
      canRotate: this.controller.canRotateSelectedFurniture(),
    };
  }

  private syncPlacementPreview(pointer: Phaser.Input.Pointer | null): void {
    const preview = this.controller.getFurniturePlacementPreview(pointer);
    const region = this.officeRegion;
    if (!preview || !region) {
      this.hidePlacementPreview();
      return;
    }

    const { worldX, worldY } = anchoredGridCellToWorldPixel(
      preview.anchorCell.col,
      preview.anchorCell.row,
      region,
    );
    const widthPx = preview.footprintW * region.layout.cellSize;
    const heightPx = preview.footprintH * region.layout.cellSize;
    const colors = this.resolvePlacementPreviewColors(preview);

    const ghost = this.ensurePlacementPreviewGhost();
    ghost.setTexture(OFFICE_PREVIEW_TEXTURE_KEY, preview.asset.atlasKey);
    ghost.setOrigin(0, 0);
    ghost.setDepth(OFFICE_PREVIEW_GHOST_DEPTH);
    ghost.setAlpha(OFFICE_PREVIEW_GHOST_ALPHA);
    ghost.setDisplaySize(widthPx, heightPx);
    ghost.setPosition(worldX, worldY);
    ghost.setVisible(true);

    this.syncPlacementPreviewCells(preview, region, colors);

    const label = this.ensurePlacementPreviewLabel();
    label.setDepth(OFFICE_PREVIEW_LABEL_DEPTH);
    label.setText(this.formatPlacementPreviewLabel(preview));
    label.setPosition(worldX, Math.max(0, worldY - 18));
    label.setVisible(true);
  }

  private syncPlacementPreviewCells(
    preview: OfficeFurniturePlacementPreview,
    region: OfficeRegion,
    colors: OfficePreviewVisualColors,
  ): void {
    const cellSize = region.layout.cellSize;
    let visibleCellCount = 0;

    for (let rowOffset = 0; rowOffset < preview.footprintH; rowOffset += 1) {
      for (let colOffset = 0; colOffset < preview.footprintW; colOffset += 1) {
        const col = preview.anchorCell.col + colOffset;
        const row = preview.anchorCell.row + rowOffset;
        if (col < 0 || row < 0 || col >= region.layout.cols || row >= region.layout.rows) {
          continue;
        }

        const cell = this.getPlacementPreviewCell(visibleCellCount);
        const { worldX, worldY } = anchoredGridCellToWorldPixel(col, row, region);
        cell.setPosition(worldX, worldY);
        cell.setSize(cellSize, cellSize);
        cell.setFillStyle(colors.fill, OFFICE_PREVIEW_FOOTPRINT_ALPHA);
        cell.setStrokeStyle(
          OFFICE_PREVIEW_FOOTPRINT_STROKE_WIDTH,
          colors.stroke,
          0.95,
        );
        cell.setVisible(true);
        visibleCellCount += 1;
      }
    }

    for (
      let index = visibleCellCount;
      index < this.officePlacementPreviewCells.length;
      index += 1
    ) {
      this.officePlacementPreviewCells[index]?.setVisible(false);
    }
  }

  private ensurePlacementPreviewGhost(): Phaser.GameObjects.Image {
    if (this.officePlacementPreviewGhost) {
      return this.officePlacementPreviewGhost;
    }

    const ghost = this.host.scene.add.image(0, 0, OFFICE_PREVIEW_TEXTURE_KEY);
    ghost.setVisible(false);
    this.officePlacementPreviewGhost = ghost;
    return ghost;
  }

  private ensurePlacementPreviewLabel(): Phaser.GameObjects.Text {
    if (this.officePlacementPreviewLabel) {
      return this.officePlacementPreviewLabel;
    }

    const label = this.host.scene.add.text(0, 0, "", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#f8fafc",
      backgroundColor: "#020617",
      padding: { x: 4, y: 2 },
    });
    label.setVisible(false);
    this.officePlacementPreviewLabel = label;
    return label;
  }

  private getPlacementPreviewCell(index: number): Phaser.GameObjects.Rectangle {
    const existing = this.officePlacementPreviewCells[index];
    if (existing) {
      return existing;
    }

    const cell = this.host.scene.add.rectangle(0, 0, 0, 0, OFFICE_PREVIEW_PLACE_FILL, 0);
    cell.setOrigin(0, 0);
    cell.setDepth(OFFICE_PREVIEW_FOOTPRINT_DEPTH);
    cell.setVisible(false);
    this.officePlacementPreviewCells.push(cell);
    return cell;
  }

  private resolvePlacementPreviewColors(
    preview: OfficeFurniturePlacementPreview,
  ): OfficePreviewVisualColors {
    switch (preview.kind) {
      case "replace":
        return {
          fill: OFFICE_PREVIEW_REPLACE_FILL,
          stroke: OFFICE_PREVIEW_REPLACE_STROKE,
        };
      case "blocked":
        return {
          fill: OFFICE_PREVIEW_BLOCKED_FILL,
          stroke: OFFICE_PREVIEW_BLOCKED_STROKE,
        };
      case "place":
      default:
        return {
          fill: OFFICE_PREVIEW_PLACE_FILL,
          stroke: OFFICE_PREVIEW_PLACE_STROKE,
        };
    }
  }

  private formatPlacementPreviewLabel(
    preview: OfficeFurniturePlacementPreview,
  ): string {
    switch (preview.kind) {
      case "replace": {
        const [firstFurniture, ...rest] = preview.affectedFurniture;
        if (!firstFurniture) {
          return "Replace";
        }

        return rest.length > 0
          ? `Replace ${firstFurniture.label} + ${rest.length} more`
          : `Replace ${firstFurniture.label}`;
      }
      case "blocked":
        return preview.blockedReason === "out-of-bounds"
          ? "Blocked: outside office bounds"
          : "Blocked";
      case "place":
      default:
        return `Place ${preview.asset.label}`;
    }
  }

  private hidePlacementPreview(): void {
    this.officePlacementPreviewGhost?.setVisible(false);
    this.officePlacementPreviewLabel?.setVisible(false);
    for (const cell of this.officePlacementPreviewCells) {
      cell.setVisible(false);
    }
  }

  private rerenderOffice(): void {
    const region = this.officeRegion;
    if (!region) {
      return;
    }

    if (this.officeRenderable) {
      this.officeRenderable.partialUpdate(region.layout);
      return;
    }

    this.officeRenderable = renderOfficeLayout(this.host.scene, region.layout, {
      worldOffsetX: region.anchorX16 * WORLD_REGION_BASE_PX,
      worldOffsetY: region.anchorY16 * WORLD_REGION_BASE_PX,
      tileDepth: RENDER_LAYERS.OFFICE_FLOOR,
    });
  }
}

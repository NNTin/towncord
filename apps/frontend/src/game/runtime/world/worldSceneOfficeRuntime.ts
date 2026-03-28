import type Phaser from "phaser";
import type { OfficeSceneBootstrap } from "../../contracts/office-scene";
import { RENDER_LAYERS } from "../../renderLayers";
import {
  WORLD_REGION_BASE_PX,
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

const OFFICE_CELL_HIGHLIGHT_FILL = 0x38bdf8;
const OFFICE_CELL_HIGHLIGHT_ALPHA = 0.22;
const OFFICE_CELL_HIGHLIGHT_STROKE_WIDTH = 2;
const OFFICE_CELL_HIGHLIGHT_STROKE = 0xe0f2fe;
const OFFICE_SELECTION_HIGHLIGHT_FILL = 0xf59e0b;
const OFFICE_SELECTION_HIGHLIGHT_ALPHA = 0.08;
const OFFICE_SELECTION_HIGHLIGHT_STROKE_WIDTH = 2;
const OFFICE_SELECTION_HIGHLIGHT_STROKE = 0xfbbf24;

type OfficeRegion = AnchoredGridRegion<OfficeSceneBootstrap["layout"]>;

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
        depthAnchorRow: officeRegion.anchorY16,
      },
    );
    this.createOfficeCellHighlight(officeRegion.layout.cellSize);
    this.createOfficeSelectionHighlight(officeRegion.layout.cellSize);
    this.syncSelectionHighlight();
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
  }

  public update(): void {
    if (!this.controller.consumePendingLayoutChange()) {
      return;
    }

    this.rerenderOffice();
    this.syncSelectionHighlight();
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
      depthAnchorRow: region.anchorY16,
    });
  }
}

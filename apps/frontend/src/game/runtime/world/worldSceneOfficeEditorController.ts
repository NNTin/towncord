import type Phaser from "phaser";
import type {
  OfficeEditorToolId,
  OfficeFloorMode,
  OfficeFloorPickedPayload,
  OfficeSetEditorToolPayload,
} from "../../contracts/office-editor";
import {
  anchoredGridCellToWorldPixel,
  worldToAnchoredGridCell,
  type AnchoredGridRegion,
} from "../../../engine/world-runtime/regions";
import type { OfficeSceneLayout } from "../../contracts/office-scene";
import {
  OfficeEditorSystem,
  type OfficeFurniturePlacementPreview,
} from "./officeEditorSystem";

type OfficeRegion = AnchoredGridRegion<OfficeSceneLayout>;

type OfficeFurnitureTarget = {
  id: string;
  bounds: Phaser.Geom.Rectangle;
};

type WorldSceneOfficeEditorControllerHost = {
  getOfficeRegion: () => OfficeRegion | null;
  getOfficeCellHighlight: () => Phaser.GameObjects.Rectangle | null;
  getOfficeFurnitureTargets: () => readonly OfficeFurnitureTarget[];
  getActivePointer: () => Phaser.Input.Pointer | null;
  getWorldPoint: (screenX: number, screenY: number) => { x: number; y: number };
  emitOfficeFloorPicked: (payload: OfficeFloorPickedPayload) => void;
};

function cloneOfficeEditorToolPayload(
  payload: OfficeSetEditorToolPayload,
): OfficeSetEditorToolPayload {
  switch (payload.tool) {
    case "floor":
      return {
        tool: "floor",
        floorMode: payload.floorMode,
        tileColor: payload.tileColor,
        floorColor: payload.floorColor,
        floorPattern: payload.floorPattern,
      };
    case "furniture":
      return {
        tool: "furniture",
        furnitureId: payload.furnitureId,
        rotationQuarterTurns: payload.rotationQuarterTurns,
      };
    case "wall":
    case "erase":
      return { tool: payload.tool };
    default:
      return { tool: null };
  }
}

function getOfficeEditorTool(
  payload: OfficeSetEditorToolPayload,
): OfficeEditorToolId | null {
  return payload.tool;
}

function getOfficeFloorMode(
  payload: OfficeSetEditorToolPayload,
): OfficeFloorMode {
  return payload.tool === "floor" ? payload.floorMode : "paint";
}

function getOfficeFloorPattern(
  payload: OfficeSetEditorToolPayload,
): string | null {
  return payload.tool === "floor" ? payload.floorPattern : null;
}

function getOfficeFurnitureId(
  payload: OfficeSetEditorToolPayload,
): string | null {
  return payload.tool === "furniture" ? payload.furnitureId : null;
}

function getOfficeFurnitureRotationQuarterTurns(
  payload: OfficeSetEditorToolPayload,
): 0 | 1 | 2 | 3 {
  return payload.tool === "furniture" ? payload.rotationQuarterTurns : 0;
}

function isPointerWithinGame(pointer: Phaser.Input.Pointer | null): boolean {
  if (!pointer) {
    return false;
  }

  return (
    !("withinGame" in pointer) ||
    Boolean((pointer as Phaser.Input.Pointer & { withinGame?: boolean }).withinGame)
  );
}

export class WorldSceneOfficeEditorController {
  private readonly officeEditorSystem = new OfficeEditorSystem();
  private officeEditorToolPayload: OfficeSetEditorToolPayload = { tool: null };
  private isOfficePainting = false;
  private officeDirty = false;
  private selectedFurnitureId: string | null = null;

  constructor(private readonly host: WorldSceneOfficeEditorControllerHost) {}

  public reset(): void {
    this.officeEditorToolPayload = { tool: null };
    this.isOfficePainting = false;
    this.officeDirty = false;
    this.selectedFurnitureId = null;
  }

  public getOfficeFloorMode(): OfficeFloorMode {
    return getOfficeFloorMode(this.officeEditorToolPayload);
  }

  public setOfficeEditorTool(payload: OfficeSetEditorToolPayload): void {
    this.officeEditorToolPayload = cloneOfficeEditorToolPayload(payload);
    if (payload.tool !== null) {
      this.selectedFurnitureId = null;
    }
    this.isOfficePainting = false;
    this.syncOfficeCellHighlight(this.host.getActivePointer());
  }

  public getSelectedFurnitureId(): string | null {
    return this.selectedFurnitureId;
  }

  public clearSelectedFurniture(): void {
    this.selectedFurnitureId = null;
  }

  public rotateSelectedFurniture(): boolean {
    const furnitureId = this.selectedFurnitureId;
    const region = this.host.getOfficeRegion();
    if (!furnitureId || !region) {
      return false;
    }

    const changed = this.officeEditorSystem.rotateFurniture(region.layout, furnitureId);
    if (changed) {
      this.officeDirty = true;
    }
    return changed;
  }

  public canRotateSelectedFurniture(): boolean {
    const furnitureId = this.selectedFurnitureId;
    const region = this.host.getOfficeRegion();
    if (!furnitureId || !region) {
      return false;
    }

    return this.officeEditorSystem.canRotateFurniture(region.layout, furnitureId);
  }

  public deleteSelectedFurniture(): boolean {
    const furnitureId = this.selectedFurnitureId;
    const region = this.host.getOfficeRegion();
    if (!furnitureId || !region) {
      return false;
    }

    const changed = this.officeEditorSystem.removeFurniture(region.layout, furnitureId);
    if (changed) {
      this.officeDirty = true;
      this.selectedFurnitureId = null;
    }
    return changed;
  }

  public consumePendingLayoutChange(): boolean {
    const pending = this.officeDirty;
    this.officeDirty = false;
    return pending;
  }

  public syncOfficeCellHighlight(pointer: Phaser.Input.Pointer | null): void {
    const highlight = this.host.getOfficeCellHighlight();
    const region = this.host.getOfficeRegion();
    const tool = getOfficeEditorTool(this.officeEditorToolPayload);
    if (
      !highlight ||
      !pointer ||
      !isPointerWithinGame(pointer) ||
      !tool ||
      !region
    ) {
      highlight?.setVisible(false);
      return;
    }

    if (tool === "furniture") {
      highlight.setVisible(false);
      return;
    }

    const worldPoint = this.host.getWorldPoint(pointer.x, pointer.y);
    const cell = worldToAnchoredGridCell(worldPoint.x, worldPoint.y, region);
    if (!cell) {
      highlight.setVisible(false);
      return;
    }

    const { worldX, worldY } = anchoredGridCellToWorldPixel(
      cell.col,
      cell.row,
      region,
    );
    highlight.setPosition(worldX, worldY);
    highlight.setVisible(true);
  }

  public getFurniturePlacementPreview(
    pointer: Phaser.Input.Pointer | null,
  ): OfficeFurniturePlacementPreview | null {
    const region = this.host.getOfficeRegion();
    if (
      !pointer ||
      !isPointerWithinGame(pointer) ||
      !region ||
      getOfficeEditorTool(this.officeEditorToolPayload) !== "furniture"
    ) {
      return null;
    }

    const worldPoint = this.host.getWorldPoint(pointer.x, pointer.y);
    const cell = worldToAnchoredGridCell(worldPoint.x, worldPoint.y, region);
    if (!cell) {
      return null;
    }

    return this.officeEditorSystem.previewFurniturePlacement(
      region.layout,
      cell,
      getOfficeFurnitureId(this.officeEditorToolPayload),
      getOfficeFurnitureRotationQuarterTurns(this.officeEditorToolPayload),
    );
  }

  public tryHandlePointerDown(pointer: Phaser.Input.Pointer): boolean {
    if (!getOfficeEditorTool(this.officeEditorToolPayload)) {
      return this.trySelectFurniture(pointer);
    }

    const region = this.host.getOfficeRegion();
    if (!region) {
      return false;
    }

    const worldPoint = this.host.getWorldPoint(pointer.x, pointer.y);
    if (this.pickOfficeFloor(region, worldPoint.x, worldPoint.y)) {
      return true;
    }

    if (this.applyOfficeTool(region, worldPoint.x, worldPoint.y)) {
      this.isOfficePainting = true;
      return true;
    }

    return false;
  }

  public tryHandleSecondaryPointerDown(pointer: Phaser.Input.Pointer): boolean {
    if (pointer.button !== 2) {
      return false;
    }

    if (getOfficeEditorTool(this.officeEditorToolPayload) !== "wall") {
      return false;
    }

    const region = this.host.getOfficeRegion();
    if (!region) {
      return false;
    }

    const worldPoint = this.host.getWorldPoint(pointer.x, pointer.y);
    const cell = worldToAnchoredGridCell(worldPoint.x, worldPoint.y, region);
    if (!cell) {
      return false;
    }

    const changed = this.officeEditorSystem.removeWall(region.layout, cell);
    if (changed) {
      this.officeDirty = true;
    }

    return changed;
  }

  public shouldContinuePainting(pointer: Phaser.Input.Pointer): boolean {
    return Boolean(
      this.isOfficePainting &&
      getOfficeEditorTool(this.officeEditorToolPayload) &&
      pointer.isDown,
    );
  }

  public continuePainting(pointer: Phaser.Input.Pointer): void {
    const region = this.host.getOfficeRegion();
    if (!region) {
      return;
    }

    const worldPoint = this.host.getWorldPoint(pointer.x, pointer.y);
    this.applyOfficeTool(region, worldPoint.x, worldPoint.y);
  }

  public endPainting(): void {
    this.isOfficePainting = false;
  }

  private emitPickedOfficeFloor(payload: OfficeFloorPickedPayload): void {
    this.host.emitOfficeFloorPicked(payload);
  }

  private trySelectFurniture(pointer: Phaser.Input.Pointer): boolean {
    const region = this.host.getOfficeRegion();
    if (!region) {
      return false;
    }

    const worldPoint = this.host.getWorldPoint(pointer.x, pointer.y);
    if (!worldToAnchoredGridCell(worldPoint.x, worldPoint.y, region)) {
      return false;
    }

    const targets = [...this.host.getOfficeFurnitureTargets()].reverse();
    const hit = targets.find((target) => target.bounds.contains(worldPoint.x, worldPoint.y));
    if (!hit) {
      this.selectedFurnitureId = null;
      return true;
    }

    this.selectedFurnitureId = hit.id;
    return true;
  }

  private pickOfficeFloor(
    region: OfficeRegion,
    worldX: number,
    worldY: number,
  ): boolean {
    if (
      getOfficeEditorTool(this.officeEditorToolPayload) !== "floor" ||
      getOfficeFloorMode(this.officeEditorToolPayload) !== "pick"
    ) {
      return false;
    }

    const cell = worldToAnchoredGridCell(worldX, worldY, region);
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
    if (this.officeEditorToolPayload.tool === "floor") {
      this.officeEditorToolPayload = {
        ...this.officeEditorToolPayload,
        floorMode: "paint",
      };
    }
    return true;
  }

  private applyOfficeTool(
    region: OfficeRegion,
    worldX: number,
    worldY: number,
  ): boolean {
    const tool = getOfficeEditorTool(this.officeEditorToolPayload);
    if (!tool) {
      return false;
    }

    const cell = worldToAnchoredGridCell(worldX, worldY, region);
    if (!cell) {
      return false;
    }

    const changed = this.officeEditorSystem.applyCommand(region.layout, {
      tool,
      cell,
      tileColor:
        this.officeEditorToolPayload.tool === "floor"
          ? this.officeEditorToolPayload.tileColor
          : null,
      floorColor:
        this.officeEditorToolPayload.tool === "floor"
          ? this.officeEditorToolPayload.floorColor
          : null,
      floorPattern: getOfficeFloorPattern(this.officeEditorToolPayload),
      furnitureId: getOfficeFurnitureId(this.officeEditorToolPayload),
      rotationQuarterTurns: getOfficeFurnitureRotationQuarterTurns(
        this.officeEditorToolPayload,
      ),
    });

    if (changed) {
      this.officeDirty = true;
    }

    return true;
  }
}

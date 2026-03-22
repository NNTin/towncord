import type Phaser from "phaser";
import type {
  OfficeEditorToolId,
  OfficeFloorMode,
  OfficeFloorPickedPayload,
  OfficeSetEditorToolPayload,
} from "../../events";
import { officeCellToWorldPixel, worldToOfficeCell, type TownOfficeRegion } from "../../town/layout";
import { OfficeEditorSystem } from "./officeEditorSystem";

type WorldSceneOfficeEditorControllerHost = {
  getOfficeRegion: () => TownOfficeRegion | null;
  getOfficeCellHighlight: () => Phaser.GameObjects.Rectangle | null;
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

function getOfficeFloorMode(payload: OfficeSetEditorToolPayload): OfficeFloorMode {
  return payload.tool === "floor" ? payload.floorMode : "paint";
}

function getOfficeFloorPattern(payload: OfficeSetEditorToolPayload): string | null {
  return payload.tool === "floor" ? payload.floorPattern : null;
}

function getOfficeFurnitureId(payload: OfficeSetEditorToolPayload): string | null {
  return payload.tool === "furniture" ? payload.furnitureId : null;
}

export class WorldSceneOfficeEditorController {
  private readonly officeEditorSystem = new OfficeEditorSystem();
  private officeEditorToolPayload: OfficeSetEditorToolPayload = { tool: null };
  private isOfficePainting = false;
  private officeDirty = false;

  constructor(private readonly host: WorldSceneOfficeEditorControllerHost) {}

  public reset(): void {
    this.officeEditorToolPayload = { tool: null };
    this.isOfficePainting = false;
    this.officeDirty = false;
  }

  public getOfficeFloorMode(): OfficeFloorMode {
    return getOfficeFloorMode(this.officeEditorToolPayload);
  }

  public setOfficeEditorTool(payload: OfficeSetEditorToolPayload): void {
    this.officeEditorToolPayload = cloneOfficeEditorToolPayload(payload);
    this.syncOfficeCellHighlight(this.host.getActivePointer());
  }

  public consumePendingLayoutChange(): boolean {
    const pending = this.officeDirty;
    this.officeDirty = false;
    return pending;
  }

  public syncOfficeCellHighlight(pointer: Phaser.Input.Pointer | null): void {
    const highlight = this.host.getOfficeCellHighlight();
    const region = this.host.getOfficeRegion();
    if (!highlight || !pointer || !getOfficeEditorTool(this.officeEditorToolPayload) || !region) {
      highlight?.setVisible(false);
      return;
    }

    const worldPoint = this.host.getWorldPoint(pointer.x, pointer.y);
    const cell = worldToOfficeCell(worldPoint.x, worldPoint.y, region);
    if (!cell) {
      highlight.setVisible(false);
      return;
    }

    const { worldX, worldY } = officeCellToWorldPixel(cell.col, cell.row, region);
    highlight.setPosition(worldX, worldY);
    highlight.setVisible(true);
  }

  public tryHandlePointerDown(pointer: Phaser.Input.Pointer): boolean {
    if (!getOfficeEditorTool(this.officeEditorToolPayload)) {
      return false;
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

  private pickOfficeFloor(region: TownOfficeRegion, worldX: number, worldY: number): boolean {
    if (getOfficeEditorTool(this.officeEditorToolPayload) !== "floor" || getOfficeFloorMode(this.officeEditorToolPayload) !== "pick") {
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
    if (this.officeEditorToolPayload.tool === "floor") {
      this.officeEditorToolPayload = {
        ...this.officeEditorToolPayload,
        floorMode: "paint",
      };
    }
    return true;
  }

  private applyOfficeTool(region: TownOfficeRegion, worldX: number, worldY: number): boolean {
    const tool = getOfficeEditorTool(this.officeEditorToolPayload);
    if (!tool) {
      return false;
    }

    const cell = worldToOfficeCell(worldX, worldY, region);
    if (!cell) {
      return false;
    }

    const changed = this.officeEditorSystem.applyCommand(region.layout, {
      tool,
      cell,
      tileColor: this.officeEditorToolPayload.tool === "floor" ? this.officeEditorToolPayload.tileColor : null,
      floorColor: this.officeEditorToolPayload.tool === "floor" ? this.officeEditorToolPayload.floorColor : null,
      floorPattern: getOfficeFloorPattern(this.officeEditorToolPayload),
      furnitureId: getOfficeFurnitureId(this.officeEditorToolPayload),
    });

    if (changed) {
      this.officeDirty = true;
    }

    return true;
  }
}

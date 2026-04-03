import type Phaser from "phaser";

type Pointer = Phaser.Input.Pointer;

type WorldRuntimeInputRouterContext = {
  beginPan: (pointer: Pointer) => void;
  hasActiveTerrainPropTool: () => boolean;
  tryHandleTerrainPropPointerDown: (pointer: Pointer) => boolean;
  tryHandleOfficePointerDown: (pointer: Pointer) => boolean;
  tryHandleOfficeSecondaryPointerDown: (pointer: Pointer) => boolean;
  hasActiveTerrainTool: () => boolean;
  beginTerrainPaint: (pointer: Pointer) => void;
  handleSelectionAndInspect: (pointer: Pointer) => void;
  isPanning: () => boolean;
  updatePan: (pointer: Pointer) => void;
  syncHover: (pointer: Pointer) => void;
  shouldContinueOfficePainting: (pointer: Pointer) => boolean;
  continueOfficePainting: (pointer: Pointer) => void;
  shouldContinueTerrainPainting: () => boolean;
  continueTerrainPainting: (pointer: Pointer) => void;
  endPan: (pointer: Pointer) => void;
  endPrimaryPointer: (pointer: Pointer) => void;
};

export class WorldRuntimeInputRouter {
  constructor(private readonly context: WorldRuntimeInputRouterContext) {}

  onPointerDown(pointer: Pointer): void {
    if (pointer.button === 1) {
      this.context.beginPan(pointer);
      return;
    }

    if (pointer.button === 2) {
      this.context.tryHandleOfficeSecondaryPointerDown(pointer);
      return;
    }

    if (pointer.button !== 0) {
      return;
    }

    if (this.context.hasActiveTerrainPropTool()) {
      this.context.tryHandleTerrainPropPointerDown(pointer);
      return;
    }

    if (this.context.hasActiveTerrainTool()) {
      this.context.beginTerrainPaint(pointer);
      return;
    }

    if (this.context.tryHandleOfficePointerDown(pointer)) {
      return;
    }

    this.context.handleSelectionAndInspect(pointer);
  }

  onPointerMove(pointer: Pointer): void {
    if (this.context.isPanning()) {
      this.context.updatePan(pointer);
      return;
    }

    this.context.syncHover(pointer);

    if (this.context.shouldContinueOfficePainting(pointer)) {
      this.context.continueOfficePainting(pointer);
      return;
    }

    if (!this.context.shouldContinueTerrainPainting()) {
      return;
    }

    this.context.continueTerrainPainting(pointer);
  }

  onPointerUp(pointer: Pointer): void {
    if (pointer.button === 1) {
      this.context.endPan(pointer);
      return;
    }

    if (pointer.button === 0) {
      this.context.endPrimaryPointer(pointer);
    }
  }
}

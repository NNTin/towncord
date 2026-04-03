import { beforeEach, describe, expect, test, vi } from "vitest";
import { WorldRuntimeInputRouter } from "../input/worldRuntimeInputRouter";

function makeContext() {
  return {
    beginPan: vi.fn(),
    hasActiveTerrainPropTool: vi.fn(() => false),
    tryHandleTerrainPropPointerDown: vi.fn(() => false),
    tryHandleOfficePointerDown: vi.fn(() => false),
    tryHandleOfficeSecondaryPointerDown: vi.fn(() => false),
    hasActiveTerrainTool: vi.fn(() => false),
    beginTerrainPaint: vi.fn(),
    handleSelectionAndInspect: vi.fn(),
    isPanning: vi.fn(() => false),
    updatePan: vi.fn(),
    syncHover: vi.fn(),
    shouldContinueOfficePainting: vi.fn(() => false),
    continueOfficePainting: vi.fn(),
    shouldContinueTerrainPainting: vi.fn(() => false),
    continueTerrainPainting: vi.fn(),
    endPan: vi.fn(),
    endPrimaryPointer: vi.fn(),
  };
}

function makePointer(button: number): Phaser.Input.Pointer {
  return { button } as Phaser.Input.Pointer;
}

describe("WorldRuntimeInputRouter", () => {
  let ctx: ReturnType<typeof makeContext>;
  let router: WorldRuntimeInputRouter;

  beforeEach(() => {
    ctx = makeContext();
    router = new WorldRuntimeInputRouter(ctx);
  });

  describe("onPointerDown", () => {
    test("middle-click (button=1) begins pan", () => {
      router.onPointerDown(makePointer(1));
      expect(ctx.beginPan).toHaveBeenCalledOnce();
      expect(ctx.tryHandleOfficePointerDown).not.toHaveBeenCalled();
    });

    test("right-click (button=2) does nothing", () => {
      router.onPointerDown(makePointer(2));
      expect(ctx.beginPan).not.toHaveBeenCalled();
      expect(ctx.tryHandleOfficePointerDown).not.toHaveBeenCalled();
      expect(ctx.tryHandleOfficeSecondaryPointerDown).toHaveBeenCalledOnce();
    });

    test("left-click with active terrain tool paints terrain before office gets a chance", () => {
      ctx.hasActiveTerrainTool.mockReturnValue(true);
      ctx.tryHandleOfficePointerDown.mockReturnValue(true);
      router.onPointerDown(makePointer(0));
      expect(ctx.beginTerrainPaint).toHaveBeenCalledOnce();
      expect(ctx.tryHandleOfficePointerDown).not.toHaveBeenCalled();
      expect(ctx.handleSelectionAndInspect).not.toHaveBeenCalled();
    });

    test("left-click with active terrain prop tool routes to prop placement before terrain or office", () => {
      ctx.hasActiveTerrainPropTool.mockReturnValue(true);
      ctx.hasActiveTerrainTool.mockReturnValue(true);
      ctx.tryHandleOfficePointerDown.mockReturnValue(true);
      router.onPointerDown(makePointer(0));
      expect(ctx.tryHandleTerrainPropPointerDown).toHaveBeenCalledOnce();
      expect(ctx.beginTerrainPaint).not.toHaveBeenCalled();
      expect(ctx.tryHandleOfficePointerDown).not.toHaveBeenCalled();
      expect(ctx.handleSelectionAndInspect).not.toHaveBeenCalled();
    });

    test("left-click lets office handle when no terrain tool is active", () => {
      ctx.tryHandleOfficePointerDown.mockReturnValue(true);
      router.onPointerDown(makePointer(0));
      expect(ctx.tryHandleOfficePointerDown).toHaveBeenCalledOnce();
      expect(ctx.beginTerrainPaint).not.toHaveBeenCalled();
      expect(ctx.handleSelectionAndInspect).not.toHaveBeenCalled();
    });

    test("left-click falls through to terrain if active tool and office does not consume", () => {
      ctx.hasActiveTerrainTool.mockReturnValue(true);
      router.onPointerDown(makePointer(0));
      expect(ctx.beginTerrainPaint).toHaveBeenCalledOnce();
      expect(ctx.handleSelectionAndInspect).not.toHaveBeenCalled();
    });

    test("left-click falls back to selection/inspect", () => {
      router.onPointerDown(makePointer(0));
      expect(ctx.handleSelectionAndInspect).toHaveBeenCalledOnce();
    });
  });

  describe("onPointerMove", () => {
    test("updates pan when panning", () => {
      ctx.isPanning.mockReturnValue(true);
      const pointer = makePointer(0);
      router.onPointerMove(pointer);
      expect(ctx.updatePan).toHaveBeenCalledWith(pointer);
      expect(ctx.syncHover).not.toHaveBeenCalled();
    });

    test("syncs hover when not panning", () => {
      const pointer = makePointer(0);
      router.onPointerMove(pointer);
      expect(ctx.syncHover).toHaveBeenCalledWith(pointer);
    });

    test("continues office painting if applicable", () => {
      ctx.shouldContinueOfficePainting.mockReturnValue(true);
      const pointer = makePointer(0);
      router.onPointerMove(pointer);
      expect(ctx.continueOfficePainting).toHaveBeenCalledWith(pointer);
      expect(ctx.continueTerrainPainting).not.toHaveBeenCalled();
    });

    test("continues terrain painting if applicable", () => {
      ctx.shouldContinueTerrainPainting.mockReturnValue(true);
      const pointer = makePointer(0);
      router.onPointerMove(pointer);
      expect(ctx.continueTerrainPainting).toHaveBeenCalledWith(pointer);
    });
  });

  describe("onPointerUp", () => {
    test("middle-click release ends pan", () => {
      const pointer = makePointer(1);
      router.onPointerUp(pointer);
      expect(ctx.endPan).toHaveBeenCalledWith(pointer);
      expect(ctx.endPrimaryPointer).not.toHaveBeenCalled();
    });

    test("left-click release ends primary pointer", () => {
      const pointer = makePointer(0);
      router.onPointerUp(pointer);
      expect(ctx.endPrimaryPointer).toHaveBeenCalledWith(pointer);
      expect(ctx.endPan).not.toHaveBeenCalled();
    });

    test("right-click release does nothing", () => {
      router.onPointerUp(makePointer(2));
      expect(ctx.endPan).not.toHaveBeenCalled();
      expect(ctx.endPrimaryPointer).not.toHaveBeenCalled();
    });
  });
});

import { beforeEach, describe, expect, test, vi } from "vitest";
import { WorldRuntimeCameraController } from "../camera/worldRuntimeCameraController";

vi.mock("phaser", () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
    },
  },
}));

function makeCamera(overrides: Partial<{
  zoom: number;
  scrollX: number;
  scrollY: number;
  width: number;
  height: number;
}> = {}) {
  return {
    zoom: overrides.zoom ?? 2,
    scrollX: overrides.scrollX ?? 0,
    scrollY: overrides.scrollY ?? 0,
    width: overrides.width ?? 800,
    height: overrides.height ?? 600,
    setZoom: vi.fn(function (this: ReturnType<typeof makeCamera>, z: number) {
      this.zoom = z;
    }),
    setScroll: vi.fn(function (this: ReturnType<typeof makeCamera>, x: number, y: number) {
      this.scrollX = x;
      this.scrollY = y;
    }),
  };
}

describe("WorldRuntimeCameraController", () => {
  let camera: ReturnType<typeof makeCamera>;
  let onZoomChanged: ReturnType<typeof vi.fn>;
  let controller: WorldRuntimeCameraController;

  beforeEach(() => {
    camera = makeCamera();
    onZoomChanged = vi.fn();
    controller = new WorldRuntimeCameraController(
      {
        getCamera: () => camera as unknown as Phaser.Cameras.Scene2D.Camera,
        getWorldBounds: () => ({ width: 1024, height: 768 }),
      },
      { onZoomChanged },
    );
  });

  test("initialize sets zoom to 2 and emits zoom changed", () => {
    controller.initialize();
    expect(camera.setZoom).toHaveBeenCalledWith(2);
    expect(onZoomChanged).toHaveBeenCalledWith({ zoom: 2, minZoom: 1, maxZoom: 16 });
  });

  test("handleWheel zooms out by one integer step when dy > 0", () => {
    camera.zoom = 4;
    controller.handleWheel(10);
    expect(camera.setZoom).toHaveBeenCalledWith(3);
    expect(onZoomChanged).toHaveBeenCalledWith(
      expect.objectContaining({ zoom: 3 }),
    );
  });

  test("handleWheel zooms in by one integer step when dy < 0", () => {
    camera.zoom = 4;
    controller.handleWheel(-10);
    expect(camera.setZoom).toHaveBeenCalledWith(5);
  });

  test("handleWheel always produces an integer zoom to keep sprites on the pixel grid", () => {
    // Non-integer zoom maps world pixel edges to fractional screen pixels,
    // creating sub-pixel gaps between adjacent sprites.
    camera.zoom = 3;
    controller.handleWheel(-1); // zoom in
    expect(Number.isInteger(camera.zoom)).toBe(true);
    controller.handleWheel(1);  // zoom out
    expect(Number.isInteger(camera.zoom)).toBe(true);
  });

  test("handleSetZoom snaps fractional values to nearest integer", () => {
    controller.handleSetZoom({ zoom: 3.7 });
    expect(camera.zoom).toBe(4);
    controller.handleSetZoom({ zoom: 2.3 });
    expect(camera.zoom).toBe(2);
  });

  test("updatePan rounds scroll to integer world pixels to keep sprites on the pixel grid", () => {
    // With zoom=3, a 1-pixel pointer move gives dx = 1/3 ≈ 0.333, which
    // produces a fractional scroll that shifts every object off the pixel grid.
    camera.zoom = 3;
    camera.scrollX = 0;
    camera.scrollY = 0;
    controller.beginPan({ x: 0, y: 0 } as Phaser.Input.Pointer);
    controller.updatePan({ x: 1, y: 1 } as Phaser.Input.Pointer);
    const calls = camera.setScroll.mock.calls;
    const [sx, sy] = calls[calls.length - 1]!;
    expect(Number.isInteger(sx)).toBe(true);
    expect(Number.isInteger(sy)).toBe(true);
  });

  test("handleSetZoom clamps to min zoom", () => {
    controller.handleSetZoom({ zoom: 0.1 });
    expect(camera.setZoom).toHaveBeenCalledWith(1);
    expect(onZoomChanged).toHaveBeenCalledWith(expect.objectContaining({ zoom: 1 }));
  });

  test("handleSetZoom clamps to max zoom", () => {
    controller.handleSetZoom({ zoom: 100 });
    expect(camera.setZoom).toHaveBeenCalledWith(16);
    expect(onZoomChanged).toHaveBeenCalledWith(expect.objectContaining({ zoom: 16 }));
  });

  test("zoom changed payload includes minZoom and maxZoom", () => {
    controller.handleSetZoom({ zoom: 4 });
    expect(onZoomChanged).toHaveBeenCalledWith({ zoom: 4, minZoom: 1, maxZoom: 16 });
  });

  test("beginPan records start positions", () => {
    camera.scrollX = 10;
    camera.scrollY = 20;
    const pointer = { x: 100, y: 200 } as Phaser.Input.Pointer;
    controller.beginPan(pointer);
    expect(controller.isPanActive()).toBe(true);
  });

  test("isPanActive returns false before pan starts", () => {
    expect(controller.isPanActive()).toBe(false);
  });

  test("endPan deactivates panning", () => {
    const pointer = { x: 0, y: 0 } as Phaser.Input.Pointer;
    controller.beginPan(pointer);
    expect(controller.isPanActive()).toBe(true);
    controller.endPan();
    expect(controller.isPanActive()).toBe(false);
  });

  test("updatePan scrolls camera by delta divided by zoom, rounded to integer world pixels", () => {
    camera.zoom = 2;
    camera.scrollX = 0;
    camera.scrollY = 0;
    const startPointer = { x: 100, y: 200 } as Phaser.Input.Pointer;
    controller.beginPan(startPointer);
    const movePointer = { x: 110, y: 220 } as Phaser.Input.Pointer;
    controller.updatePan(movePointer);
    // dx = 10/2 = 5, dy = 20/2 = 10 — already integers at zoom=2.
    expect(camera.setScroll).toHaveBeenCalledWith(
      Math.round(0 - 10 / 2),
      Math.round(0 - 20 / 2),
    );
  });

  test("reset clears pan state", () => {
    const pointer = { x: 50, y: 50 } as Phaser.Input.Pointer;
    controller.beginPan(pointer);
    controller.reset();
    expect(controller.isPanActive()).toBe(false);
  });

  test("initialize centers camera on world bounds with sidebar offset", () => {
    const bigCamera = makeCamera({ zoom: 1, width: 800, height: 600 });
    const ctrl = new WorldRuntimeCameraController(
      {
        getCamera: () => bigCamera as unknown as Phaser.Cameras.Scene2D.Camera,
        getWorldBounds: () => ({ width: 2000, height: 1200 }),
      },
      { onZoomChanged },
    );
    ctrl.initialize();
    // scrollX = 2000/2 - 800/2 - 180/(2*2) = 1000 - 400 - 45 = 555
    // scrollY = 1200/2 - 600/2 = 300
    expect(bigCamera.setScroll).toHaveBeenCalledWith(555, 300);
  });

  test("updatePan applies delta divided by zoom correctly", () => {
    camera.zoom = 2;
    camera.scrollX = 50;
    camera.scrollY = 70;
    controller.beginPan({ x: 100, y: 100 } as Phaser.Input.Pointer);
    controller.updatePan({ x: 120, y: 80 } as Phaser.Input.Pointer);
    // dx = (120-100)/2 = 10, dy = (80-100)/2 = -10
    // newScrollX = 50 - 10 = 40, newScrollY = 70 - (-10) = 80
    expect(camera.setScroll).toHaveBeenCalledWith(40, 80);
  });

  test("centerCameraOnWorld does nothing when getWorldBounds returns null", () => {
    const nullBoundsController = new WorldRuntimeCameraController(
      {
        getCamera: () => camera as unknown as Phaser.Cameras.Scene2D.Camera,
        getWorldBounds: () => null,
      },
      { onZoomChanged },
    );
    nullBoundsController.centerCameraOnWorld();
    expect(camera.setScroll).not.toHaveBeenCalled();
  });
});

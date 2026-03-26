import { beforeEach, describe, expect, test, vi } from "vitest";
import { WorldRuntimeDiagnosticsController } from "../diagnostics/worldRuntimeDiagnosticsController";

describe("WorldRuntimeDiagnosticsController", () => {
  let onRuntimePerf: ReturnType<typeof vi.fn>;
  let now: ReturnType<typeof vi.fn>;
  let controller: WorldRuntimeDiagnosticsController;

  beforeEach(() => {
    onRuntimePerf = vi.fn();
    now = vi.fn(() => 0);
    controller = new WorldRuntimeDiagnosticsController({ onRuntimePerf }, { now });
  });

  test("emits on first frame", () => {
    now.mockReturnValue(200);
    controller.recordFrame(16, 184, 2);
    expect(onRuntimePerf).toHaveBeenCalledOnce();
  });

  test("throttles emission to 100ms intervals", () => {
    now.mockReturnValue(200);
    controller.recordFrame(16, 184, 2);
    now.mockReturnValue(250);
    controller.recordFrame(16, 234, 2);
    expect(onRuntimePerf).toHaveBeenCalledOnce();
  });

  test("emits again after 100ms have elapsed", () => {
    now.mockReturnValue(200);
    controller.recordFrame(16, 184, 2);
    now.mockReturnValue(301);
    controller.recordFrame(16, 285, 2);
    expect(onRuntimePerf).toHaveBeenCalledTimes(2);
  });

  test("payload includes correct fps derived from delta", () => {
    now.mockReturnValue(500);
    controller.recordFrame(20, 480, 3);
    expect(onRuntimePerf).toHaveBeenCalledWith(
      expect.objectContaining({
        fps: 1000 / 20,
        frameMs: 20,
        terrainMs: 3,
        timestampMs: 500,
        updateMs: 500 - 480,
      }),
    );
  });

  test("fps is 0 when delta is 0", () => {
    now.mockReturnValue(200);
    controller.recordFrame(0, 200, 0);
    expect(onRuntimePerf).toHaveBeenCalledWith(expect.objectContaining({ fps: 0 }));
  });

  test("reset allows immediate emission again", () => {
    now.mockReturnValue(200);
    controller.recordFrame(16, 184, 2);
    now.mockReturnValue(250);
    controller.reset();
    controller.recordFrame(16, 234, 2);
    expect(onRuntimePerf).toHaveBeenCalledTimes(2);
  });
});

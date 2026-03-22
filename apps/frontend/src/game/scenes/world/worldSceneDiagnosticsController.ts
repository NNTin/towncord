import type { RuntimePerfPayload } from "../../protocol";
import type { WorldSceneProjectionEmitter } from "./worldSceneProjections";

type WorldSceneDiagnosticsControllerOptions = {
  now?: () => number;
};

export class WorldSceneDiagnosticsController {
  private readonly now: () => number;
  private lastPerfEmitAtMs = 0;

  constructor(
    private readonly projections: WorldSceneProjectionEmitter,
    options: WorldSceneDiagnosticsControllerOptions = {},
  ) {
    this.now = options.now ?? (() => performance.now());
  }

  public recordFrame(delta: number, updateStartAtMs: number, terrainMs: number): void {
    const now = this.now();
    if (now - this.lastPerfEmitAtMs < 100) {
      return;
    }

    const payload: RuntimePerfPayload = {
      timestampMs: now,
      fps: delta > 0 ? 1000 / delta : 0,
      frameMs: delta,
      updateMs: now - updateStartAtMs,
      terrainMs,
    };
    this.projections.emitRuntimePerf(payload);
    this.lastPerfEmitAtMs = now;
  }

  public reset(): void {
    this.lastPerfEmitAtMs = 0;
  }
}

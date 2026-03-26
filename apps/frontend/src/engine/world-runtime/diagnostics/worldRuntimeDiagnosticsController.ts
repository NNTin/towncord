import type { WorldRuntimePerfPayload } from "../contracts";

type WorldRuntimeDiagnosticsControllerCallbacks = {
  onRuntimePerf: (payload: WorldRuntimePerfPayload) => void;
};

type WorldRuntimeDiagnosticsControllerOptions = {
  now?: () => number;
};

export class WorldRuntimeDiagnosticsController {
  private readonly now: () => number;
  private lastPerfEmitAtMs = 0;

  constructor(
    private readonly callbacks: WorldRuntimeDiagnosticsControllerCallbacks,
    options: WorldRuntimeDiagnosticsControllerOptions = {},
  ) {
    this.now = options.now ?? (() => performance.now());
  }

  public recordFrame(delta: number, updateStartAtMs: number, terrainMs: number): void {
    const now = this.now();
    if (now - this.lastPerfEmitAtMs < 100) {
      return;
    }

    const payload: WorldRuntimePerfPayload = {
      timestampMs: now,
      fps: delta > 0 ? 1000 / delta : 0,
      frameMs: delta,
      updateMs: now - updateStartAtMs,
      terrainMs,
    };
    this.callbacks.onRuntimePerf(payload);
    this.lastPerfEmitAtMs = now;
  }

  public reset(): void {
    this.lastPerfEmitAtMs = 0;
  }
}

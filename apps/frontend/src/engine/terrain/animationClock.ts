import { DEFAULT_TERRAIN_ANIMATION_FRAME_MS } from "./contracts";
import {
  buildTerrainPingPongFrameIndices,
  getTerrainAnimationId,
  normalizeTerrainPhaseDurations,
  resolveTerrainPhaseIndex,
} from "./terrainRenderer";

export class TerrainAnimationClock {
  private readonly currentPhaseByAnimationId = new Map<string, number>();
  private readonly animationPhaseDurationsById = new Map<string, number[]>();

  constructor(
    animationPhaseDurationsById: Readonly<
      Record<string, readonly number[]>
    > = {},
    private readonly fallbackPhaseDurationMs: number = DEFAULT_TERRAIN_ANIMATION_FRAME_MS,
  ) {
    for (const [animationId, durationsMs] of Object.entries(
      animationPhaseDurationsById,
    )) {
      if (
        Array.isArray(durationsMs) &&
        durationsMs.length > 0 &&
        durationsMs.every(
          (duration) => Number.isInteger(duration) && duration > 0,
        )
      ) {
        this.animationPhaseDurationsById.set(animationId, [...durationsMs]);
      }
    }
  }

  public getPhaseDurationsForBaseFrame(
    baseFrame: string,
    variantCount: number,
  ): number[] {
    const animationId = getTerrainAnimationId(baseFrame);
    const durationsMs = this.animationPhaseDurationsById.get(animationId);
    return normalizeTerrainPhaseDurations(
      durationsMs,
      variantCount,
      this.fallbackPhaseDurationMs,
    );
  }

  public getCurrentPhase(animationId: string): number {
    return this.currentPhaseByAnimationId.get(animationId) ?? 0;
  }

  public tick(
    nowMs: number,
    animatedTileVariants: Iterable<{ baseFrame: string; variants: string[] }>,
  ): boolean {
    const nextPhaseByAnimationId = new Map<string, number>();

    for (const { baseFrame, variants } of animatedTileVariants) {
      if (variants.length <= 1) continue;

      const animationId = getTerrainAnimationId(baseFrame);
      if (nextPhaseByAnimationId.has(animationId)) continue;

      const phaseDurationsMs = this.getPhaseDurationsForBaseFrame(
        baseFrame,
        variants.length,
      );
      const playbackFrameIndices = buildTerrainPingPongFrameIndices(
        variants.length,
      );
      const playbackDurationsMs = playbackFrameIndices.map(
        (frameIndex) =>
          phaseDurationsMs[frameIndex] ?? this.fallbackPhaseDurationMs,
      );
      const playbackPhaseIndex = resolveTerrainPhaseIndex(
        nowMs,
        playbackDurationsMs,
      );
      nextPhaseByAnimationId.set(
        animationId,
        playbackFrameIndices[playbackPhaseIndex] ?? 0,
      );
    }

    if (nextPhaseByAnimationId.size === 0) {
      return false;
    }

    let changed = false;
    for (const [animationId, phaseIndex] of nextPhaseByAnimationId.entries()) {
      if (this.currentPhaseByAnimationId.get(animationId) !== phaseIndex) {
        changed = true;
        break;
      }
    }

    if (
      !changed &&
      this.currentPhaseByAnimationId.size === nextPhaseByAnimationId.size
    ) {
      return false;
    }

    this.currentPhaseByAnimationId.clear();
    for (const [animationId, phaseIndex] of nextPhaseByAnimationId.entries()) {
      this.currentPhaseByAnimationId.set(animationId, phaseIndex);
    }

    return true;
  }

  public resolveFrame(baseFrame: string, variants: string[]): string {
    if (variants.length <= 1) return baseFrame;

    const animationId = getTerrainAnimationId(baseFrame);
    const index = this.currentPhaseByAnimationId.get(animationId) ?? 0;
    return variants[index] ?? baseFrame;
  }

  public clear(): void {
    this.currentPhaseByAnimationId.clear();
    this.animationPhaseDurationsById.clear();
  }
}

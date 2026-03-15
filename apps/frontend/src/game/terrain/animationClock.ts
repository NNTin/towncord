import { DEFAULT_TERRAIN_ANIMATION_FRAME_MS } from "./contracts";
import { getTerrainAnimationId, normalizeTerrainPhaseDurations, resolveTerrainPhaseIndex } from "./renderer";

export class TerrainAnimationClock {
  private readonly currentPhaseByAnimationId = new Map<string, number>();
  private readonly animationPhaseDurationsById = new Map<string, number[]>();

  constructor(
    animationPhaseDurationsById: Readonly<Record<string, readonly number[]>> = {},
    private readonly fallbackPhaseDurationMs: number = DEFAULT_TERRAIN_ANIMATION_FRAME_MS,
  ) {
    for (const [animationId, durationsMs] of Object.entries(animationPhaseDurationsById)) {
      if (
        Array.isArray(durationsMs) &&
        durationsMs.length > 0 &&
        durationsMs.every((duration) => Number.isInteger(duration) && duration > 0)
      ) {
        this.animationPhaseDurationsById.set(animationId, [...durationsMs]);
      }
    }
  }

  /**
   * Returns the normalized phase durations for the given base frame and variant count.
   * Uses stored per-animation overrides where available, falling back to the default duration.
   */
  public getPhaseDurationsForBaseFrame(baseFrame: string, variantCount: number): number[] {
    const animationId = getTerrainAnimationId(baseFrame);
    const durationsMs = this.animationPhaseDurationsById.get(animationId);
    return normalizeTerrainPhaseDurations(durationsMs, variantCount, this.fallbackPhaseDurationMs);
  }

  /**
   * Returns the current phase index for the given animation ID, or 0 if not yet set.
   */
  public getCurrentPhase(animationId: string): number {
    return this.currentPhaseByAnimationId.get(animationId) ?? 0;
  }

  /**
   * Updates internal phase state given the current time and a collection of visible animated tiles.
   * Each entry in `animatedTileVariants` maps a base frame to its resolved variant list.
   *
   * Returns true when at least one animation's phase changed (caller should redraw).
   */
  public tick(
    nowMs: number,
    animatedTileVariants: Iterable<{ baseFrame: string; variants: string[] }>,
  ): boolean {
    const nextPhaseByAnimationId = new Map<string, number>();

    for (const { baseFrame, variants } of animatedTileVariants) {
      if (variants.length <= 1) continue;

      const animationId = getTerrainAnimationId(baseFrame);
      if (nextPhaseByAnimationId.has(animationId)) continue;

      const durationsMs = this.getPhaseDurationsForBaseFrame(baseFrame, variants.length);
      nextPhaseByAnimationId.set(animationId, resolveTerrainPhaseIndex(nowMs, durationsMs));
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

    if (!changed && this.currentPhaseByAnimationId.size === nextPhaseByAnimationId.size) {
      return false;
    }

    this.currentPhaseByAnimationId.clear();
    for (const [animationId, phaseIndex] of nextPhaseByAnimationId.entries()) {
      this.currentPhaseByAnimationId.set(animationId, phaseIndex);
    }

    return true;
  }

  /**
   * Resolves the current animation frame for the given base frame and its variants.
   * Returns the variant frame corresponding to the current phase, or the base frame if
   * there are no variants.
   */
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

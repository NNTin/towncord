import { describe, expect, test } from "vitest";
import { TerrainAnimationClock } from "../animationClock";

describe("TerrainAnimationClock", () => {
  test("plays animated terrain variants in a ping-pong loop", () => {
    const animationId = "tilesets.farmrpg.grass-water.spring";
    const baseFrame = `${animationId}#15`;
    const variants = Array.from(
      { length: 5 },
      (_, phase) => `${baseFrame}@${phase}`,
    );
    const clock = new TerrainAnimationClock({
      [animationId]: Array.from({ length: variants.length }, () => 100),
    });

    const resolveFrameAt = (nowMs: number) => {
      clock.tick(nowMs, [{ baseFrame, variants }]);
      return clock.resolveFrame(baseFrame, variants);
    };

    expect(resolveFrameAt(0)).toBe(`${baseFrame}@0`);
    expect(resolveFrameAt(100)).toBe(`${baseFrame}@1`);
    expect(resolveFrameAt(200)).toBe(`${baseFrame}@2`);
    expect(resolveFrameAt(300)).toBe(`${baseFrame}@3`);
    expect(resolveFrameAt(400)).toBe(`${baseFrame}@4`);
    expect(resolveFrameAt(500)).toBe(`${baseFrame}@3`);
    expect(resolveFrameAt(600)).toBe(`${baseFrame}@2`);
    expect(resolveFrameAt(700)).toBe(`${baseFrame}@1`);
    expect(resolveFrameAt(800)).toBe(`${baseFrame}@0`);
  });
});

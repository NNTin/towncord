import { describe, expect, test, vi } from "vitest";
import { registerBloomseedAnimations } from "../animation";
import { BLOOMSEED_ANIMATIONS_JSON_KEY } from "../preload";

function createScene(manifest: unknown) {
  const create = vi.fn();

  return {
    scene: {
      cache: {
        json: {
          get: vi.fn((key: string) => (key === BLOOMSEED_ANIMATIONS_JSON_KEY ? manifest : null)),
        },
      },
      textures: {
        exists: vi.fn(() => true),
      },
      anims: {
        exists: vi.fn(() => false),
        create,
      },
    },
    create,
  };
}

describe("registerBloomseedAnimations timing", () => {
  test("uses exported per-frame durations when present", () => {
    const { scene, create } = createScene({
      namespace: "bloomseed",
      animations: {
        "characters.hero.walk": {
          atlasKey: "bloomseed.characters",
          frames: ["walk#0", "walk#1"],
          durationsMs: [80, 120],
          phaseDurationsMs: [80, 120],
          category: "characters",
          frameCount: 2,
          frameSize: { w: 16, h: 16 },
          sourceFile: "aseprite/characters/hero.aseprite",
        },
      },
    });

    registerBloomseedAnimations(scene as never);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "characters.hero.walk",
        frames: [
          { key: "bloomseed.characters", frame: "walk#0", duration: 80 },
          { key: "bloomseed.characters", frame: "walk#1", duration: 120 },
        ],
      }),
    );

    const config = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(config).not.toHaveProperty("frameRate");
  });

  test("throws when exported durations are mismatched", () => {
    const { scene, create } = createScene({
      namespace: "bloomseed",
      animations: {
        "characters.hero.walk": {
          atlasKey: "bloomseed.characters",
          frames: ["walk#0", "walk#1"],
          durationsMs: [80],
          phaseDurationsMs: [80],
          category: "characters",
          frameCount: 2,
          frameSize: { w: 16, h: 16 },
          sourceFile: "aseprite/characters/hero.aseprite",
        },
      },
    });

    expect(() => registerBloomseedAnimations(scene as never)).toThrow(
      'Invalid animation durations for atlas "bloomseed.characters".',
    );
    expect(create).not.toHaveBeenCalled();
  });
});

import { describe, expect, test, vi } from "vitest";
import {
  registerBloomseedAnimations,
  registerDonargOfficeAnimations,
} from "../animation";
import {
  BLOOMSEED_ANIMATIONS_JSON_KEY,
  DONARG_OFFICE_ANIMATIONS_JSON_KEY,
} from "../preload";

function createScene(manifestByKey: Record<string, unknown>) {
  const create = vi.fn();

  return {
    scene: {
      cache: {
        json: {
          get: vi.fn((key: string) => manifestByKey[key] ?? null),
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

function createTimingManifest(durationsMs: unknown) {
  return {
    namespace: "bloomseed",
    animations: {
      "characters.hero.walk": {
        atlasKey: "bloomseed.characters",
        frames: ["walk#0", "walk#1"],
        durationsMs,
        phaseDurationsMs: [80, 120],
        category: "characters",
        frameCount: 2,
        frameSize: { w: 16, h: 16 },
        sourceFile: "aseprite/characters/hero.aseprite",
      },
    },
  };
}

function expectInvalidDurationsManifest(
  durationsMs: unknown,
  expectedMessage: RegExp | string,
): void {
  const { scene, create } = createScene({
    [BLOOMSEED_ANIMATIONS_JSON_KEY]: createTimingManifest(durationsMs),
  });

  expect(() => registerBloomseedAnimations(scene as never)).toThrow(
    expectedMessage,
  );
  expect(create).not.toHaveBeenCalled();
}

describe("registerBloomseedAnimations timing", () => {
  test("uses exported per-frame durations when present", () => {
    const { scene, create } = createScene({
      [BLOOMSEED_ANIMATIONS_JSON_KEY]: {
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
      [BLOOMSEED_ANIMATIONS_JSON_KEY]: {
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
      },
    });

    expect(() => registerBloomseedAnimations(scene as never)).toThrow(
      'Invalid animation durations for atlas "bloomseed.characters".',
    );
    expect(create).not.toHaveBeenCalled();
  });

  test("throws when exported durations include non-integer values", () => {
    expectInvalidDurationsManifest(
      [80.5, 120],
      /Invalid animation manifest for cache key "bloomseed\.animations"\..*must be integer/,
    );
  });

  test("throws when exported durations include non-positive values", () => {
    expectInvalidDurationsManifest(
      [0, 120],
      /Invalid animation manifest for cache key "bloomseed\.animations"\..*must be >= 1/,
    );
  });

  test("throws when exported durations are not an array", () => {
    expectInvalidDurationsManifest(
      "not-an-array",
      /Invalid animation manifest for cache key "bloomseed\.animations"\..*must be array/,
    );
  });

  test("registers Donarg office animations from the Donarg manifest key", () => {
    const { scene, create } = createScene({
      [DONARG_OFFICE_ANIMATIONS_JSON_KEY]: {
        namespace: "donarg.office",
        animations: {
          "characters.palette-0.office-worker.walk-right": {
            atlasKey: "donarg.office.characters",
            frames: ["walk-right#0", "walk-right#1"],
            durationsMs: [100, 100],
            phaseDurationsMs: [100, 100],
            category: "characters",
            frameCount: 2,
            frameSize: { w: 16, h: 32 },
            sourceFile: "aseprite/characters/office-worker.aseprite",
            paletteVariant: "palette-0",
          },
        },
      },
    });

    registerDonargOfficeAnimations(scene as never);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "characters.palette-0.office-worker.walk-right",
        frames: [
          { key: "donarg.office.characters", frame: "walk-right#0", duration: 100 },
          { key: "donarg.office.characters", frame: "walk-right#1", duration: 100 },
        ],
      }),
    );
  });
});

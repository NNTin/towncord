import { describe, expect, test, vi } from "vitest";
import {
  registerBloomseedAnimations,
  registerDonargOfficeAnimations,
  registerPreloadAnimations,
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

function createAnimationDefinition(
  atlasKey: string,
  sourceFile: string,
  category: string,
  frames: string[],
  durationsMs: number[],
  options: { paletteVariant?: string | null } = {},
) {
  return {
    atlasKey,
    frames,
    durationsMs,
    phaseDurationsMs: durationsMs,
    category,
    frameCount: frames.length,
    frameSize: { w: 16, h: 16 },
    sourceFile,
    ...(options.paletteVariant !== undefined
      ? { paletteVariant: options.paletteVariant }
      : {}),
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
          "environment.carpet.variant-a": {
            atlasKey: "donarg.office.environment",
            frames: ["variant-a#0"],
            durationsMs: [200],
            phaseDurationsMs: [200],
            category: "environment",
            frameCount: 1,
            frameSize: { w: 48, h: 48 },
            sourceFile: "aseprite/environment/carpet.aseprite",
          },
        },
      },
    });

    registerDonargOfficeAnimations(scene as never);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "environment.carpet.variant-a",
        frames: [
          { key: "donarg.office.environment", frame: "variant-a#0", duration: 200 },
        ],
      }),
    );
  });

  test("registers Bloomseed and Donarg office character animations during preload", () => {
    const { scene, create } = createScene({
      [BLOOMSEED_ANIMATIONS_JSON_KEY]: {
        namespace: "bloomseed",
        animations: {
          "characters.bloomseed.player.female.walk-down": createAnimationDefinition(
            "bloomseed.characters",
            "aseprite/characters/player-female.aseprite",
            "characters",
            ["walk-down#0", "walk-down#1"],
            [80, 120],
          ),
        },
      },
      [DONARG_OFFICE_ANIMATIONS_JSON_KEY]: {
        namespace: "donarg.office",
        animations: {
          "characters.palette-0.office-worker.walk-right": createAnimationDefinition(
            "donarg.office.characters",
            "aseprite/characters/office-worker.aseprite",
            "characters",
            ["walk-right#0", "walk-right#1"],
            [100, 100],
            { paletteVariant: "palette-0" },
          ),
          "environment.floors.pattern-01": createAnimationDefinition(
            "donarg.office.environment",
            "aseprite/environment/floors.aseprite",
            "environment",
            ["pattern-01#0"],
            [100],
          ),
        },
      },
    });

    const registration = registerPreloadAnimations(scene as never);

    expect(create).toHaveBeenCalledTimes(2);
    expect(registration).toEqual({
      bloomseedAnimationKeys: [
        "characters.bloomseed.player.female.walk-down",
      ],
      donargOfficeCharacterAnimationKeys: [
        "characters.palette-0.office-worker.walk-right",
      ],
      animationKeys: [
        "characters.bloomseed.player.female.walk-down",
        "characters.palette-0.office-worker.walk-right",
      ],
    });
    expect(create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        key: "environment.floors.pattern-01",
      }),
    );
  });
});
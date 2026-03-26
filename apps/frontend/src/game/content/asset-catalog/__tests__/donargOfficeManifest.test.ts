import { describe, expect, test } from "vitest";
import { listDonargOfficeCharacterAnimations } from "../donargOfficeManifest";

describe("donargOfficeManifest", () => {
  test("discovers and normalizes office character animations from the public manifest", () => {
    const manifest = {
      namespace: "donarg.office",
      animations: {
        "furniture.desks.counter-wood-md": {
          atlasKey: "donarg.office.furniture",
          frames: ["counter-wood-md#0"],
          durationsMs: [100],
          phaseDurationsMs: [100],
          category: "furniture",
          frameCount: 1,
          frameSize: { w: 16, h: 16 },
          sourceFile: "aseprite/furniture/desks.aseprite",
        },
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
        "characters.palette-1.office-worker.read-up": {
          atlasKey: "donarg.office.characters",
          frames: ["read-up#0"],
          durationsMs: [120],
          phaseDurationsMs: [120],
          category: "characters",
          frameCount: 1,
          frameSize: { w: 16, h: 32 },
          sourceFile: "aseprite/characters/office-worker.aseprite",
          paletteVariant: null,
        },
        "characters.palette-2.walk-down": {
          atlasKey: "donarg.office.characters",
          frames: ["walk-down#0"],
          durationsMs: [100],
          phaseDurationsMs: [100],
          category: "characters",
          frameCount: 1,
          frameSize: { w: 16, h: 32 },
          sourceFile: "aseprite/characters/office-worker.aseprite",
          paletteVariant: "palette-2",
        },
      },
    };

    expect(listDonargOfficeCharacterAnimations(manifest)).toEqual([
      {
        animationId: "characters.palette-0.office-worker.walk-right",
        atlasKey: "donarg.office.characters",
        palette: "palette-0",
        characterId: "office-worker",
        actionId: "walk",
        direction: "right",
      },
      {
        animationId: "characters.palette-1.office-worker.read-up",
        atlasKey: "donarg.office.characters",
        palette: "palette-1",
        characterId: "office-worker",
        actionId: "read",
        direction: "up",
      },
    ]);
  });
});
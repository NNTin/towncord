import { describe, expect, test } from "vitest";
import { resolveOfficeTileColorAdjustPreset } from "../colors";

describe("resolveOfficeTileColorAdjustPreset", () => {
  test("falls back to the neutral preset for invalid keys", () => {
    expect(resolveOfficeTileColorAdjustPreset("toString")).toEqual(
      resolveOfficeTileColorAdjustPreset("neutral"),
    );
  });
});

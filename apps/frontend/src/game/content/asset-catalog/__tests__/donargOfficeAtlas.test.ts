import { describe, expect, test } from "vitest";
import {
  DONARG_OFFICE_ATLAS_H,
  DONARG_OFFICE_ATLAS_W,
  getDonargOfficeAtlasFrame,
} from "../donargOfficeAtlas";

describe("donargOfficeAtlas", () => {
  test("exposes office worker frames from the Donarg office atlas", () => {
    expect(DONARG_OFFICE_ATLAS_W).toBeGreaterThan(0);
    expect(DONARG_OFFICE_ATLAS_H).toBeGreaterThan(0);
    expect(
      getDonargOfficeAtlasFrame(
        "characters.palette-0.office-worker.walk-down#0",
      ),
    ).toMatchObject({
      w: 16,
      h: 32,
    });
  });
});

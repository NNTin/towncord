import { describe, expect, test } from "vitest";
import { TerrainPaintSession } from "../terrainPaintSession";

describe("TerrainPaintSession", () => {
  test("dedupes repeated cells within a stroke", () => {
    const session = new TerrainPaintSession();
    session.begin();

    expect(session.shouldPaintCell({ cellX: 1, cellY: 2 })).toBe(true);
    expect(session.shouldPaintCell({ cellX: 1, cellY: 2 })).toBe(false);
    expect(session.shouldPaintCell({ cellX: 2, cellY: 2 })).toBe(true);
  });

  test("allows repainting the same cell in a new stroke", () => {
    const session = new TerrainPaintSession();
    session.begin();

    expect(session.shouldPaintCell({ cellX: 3, cellY: 4 })).toBe(true);
    session.end();
    session.begin();

    expect(session.shouldPaintCell({ cellX: 3, cellY: 4 })).toBe(true);
  });
});

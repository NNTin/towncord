import { describe, expect, test } from "vitest";
import { createStaticOfficeSceneContentRepository } from "../officeContentRepository";

describe("office scene content repository", () => {
  test("returns cloned snapshots for each read", () => {
    const repository = createStaticOfficeSceneContentRepository({
      sourceId: "test-content",
      layout: {
        version: 2,
        cols: 1,
        rows: 1,
        tiles: [0],
        furniture: [],
      },
      furnitureCatalog: {
        assets: [],
      },
    });

    const first = repository.read();
    const second = repository.read();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.layout).not.toBe(second.layout);
    expect(first.furnitureCatalog).not.toBe(second.furnitureCatalog);

    first.layout.cols = 99;

    expect(repository.read().layout.cols).toBe(1);
  });
});

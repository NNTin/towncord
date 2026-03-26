import { describe, expect, test } from "vitest";
import {
  parseOfficeLayout,
  type OfficeLayoutDocument,
} from "../officeLayoutDocument";

describe("document import office layout translation", () => {
  test("parses valid office layout JSON documents", () => {
    const document: OfficeLayoutDocument = {
      version: 2,
      cols: 2,
      rows: 1,
      tiles: [0, 1],
      furniture: [],
      characters: [],
    };

    expect(parseOfficeLayout(JSON.stringify(document))).toEqual({
      document,
      error: null,
    });
  });

  test("preserves validation and parse errors", () => {
    expect(parseOfficeLayout("[]")).toEqual({
      document: null,
      error: "The office layout JSON is missing required top-level fields.",
    });
    expect(parseOfficeLayout("{")).toEqual({
      document: null,
      error: expect.any(String),
    });
  });
});

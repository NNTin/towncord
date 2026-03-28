import { describe, expect, test } from "vitest";
import { isOfficeLayoutDocument } from "../officeLayoutDocument";

describe("isOfficeLayoutDocument", () => {
  const base = { version: 2, cols: 2, rows: 1, tiles: [0, 1] };

  test("returns true for a minimal valid document", () => {
    expect(isOfficeLayoutDocument(base)).toBe(true);
  });

  test("returns true when anchor has finite x and y numbers", () => {
    expect(isOfficeLayoutDocument({ ...base, anchor: { x: 10, y: 20 } })).toBe(true);
  });

  test("returns false when anchor.x is a string", () => {
    expect(isOfficeLayoutDocument({ ...base, anchor: { x: "1", y: 2 } })).toBe(false);
  });

  test("returns false when anchor.y is a string", () => {
    expect(isOfficeLayoutDocument({ ...base, anchor: { x: 1, y: "2" } })).toBe(false);
  });

  test("returns false when anchor.x is Infinity", () => {
    expect(isOfficeLayoutDocument({ ...base, anchor: { x: Infinity, y: 0 } })).toBe(false);
  });

  test("returns false when anchor.y is NaN", () => {
    expect(isOfficeLayoutDocument({ ...base, anchor: { x: 0, y: NaN } })).toBe(false);
  });

  test("returns false when anchor is a non-object", () => {
    expect(isOfficeLayoutDocument({ ...base, anchor: 42 })).toBe(false);
  });

  test("returns false when anchor is null", () => {
    expect(isOfficeLayoutDocument({ ...base, anchor: null })).toBe(false);
  });

  test("returns true when anchor is undefined (omitted)", () => {
    expect(isOfficeLayoutDocument({ ...base, anchor: undefined })).toBe(true);
  });

  test("returns false when required fields are missing", () => {
    expect(isOfficeLayoutDocument({ cols: 2, rows: 1, tiles: [] })).toBe(false);
    expect(isOfficeLayoutDocument({ version: 2, rows: 1, tiles: [] })).toBe(false);
    expect(isOfficeLayoutDocument({ version: 2, cols: 2, tiles: [] })).toBe(false);
    expect(isOfficeLayoutDocument({ version: 2, cols: 2, rows: 1 })).toBe(false);
  });

  test("returns false for null or non-objects", () => {
    expect(isOfficeLayoutDocument(null)).toBe(false);
    expect(isOfficeLayoutDocument(undefined)).toBe(false);
    expect(isOfficeLayoutDocument("string")).toBe(false);
    expect(isOfficeLayoutDocument(42)).toBe(false);
  });
});

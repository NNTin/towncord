import { describe, expect, test, vi } from "vitest";
import {
  createOfficeLayoutEditorService,
  toOfficeEditorStatusText,
  type OfficeLayoutPersistenceAdapter,
  type OfficeLayoutDocument,
} from "../officeLayoutEditorService";

describe("officeLayoutEditorService", () => {
  test("proxies load and save through the persistence adapter", async () => {
    const document: OfficeLayoutDocument = {
      version: 2,
      cols: 2,
      rows: 1,
      tiles: [0, 1],
      furniture: [],
      characters: [],
    };
    const snapshot = {
      document,
      sourcePath: "/workspace/default-layout.json",
      updatedAt: "2026-03-24T08:00:00.000Z",
    };
    const persistence: OfficeLayoutPersistenceAdapter = {
      id: "test",
      isAvailable: true,
      unavailableReason: null,
      load: vi.fn(async () => snapshot),
      save: vi.fn(async () => snapshot),
    };
    const service = createOfficeLayoutEditorService(persistence);

    await expect(service.load()).resolves.toEqual(snapshot);
    await expect(service.save(document)).resolves.toEqual(snapshot);
    expect(persistence.load).toHaveBeenCalledTimes(1);
    expect(persistence.save).toHaveBeenCalledWith(document);
  });

  test("preserves status helper behavior", () => {
    expect(
      toOfficeEditorStatusText({
        isAvailable: true,
        isLoading: false,
        isSaving: false,
        isDirty: true,
        error: null,
        parseError: null,
      }),
    ).toBe("Unsaved");
  });
});

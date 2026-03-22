import { describe, expect, test, vi } from "vitest";
import { createOfficeLayoutPersistenceAdapter, createDevelopmentOfficeLayoutPersistenceAdapter } from "../officeLayoutApi";
import { OFFICE_LAYOUT_DEV_ROUTE } from "../officeLayoutContracts";

describe("office layout persistence adapter", () => {
  test("selects the development adapter when config enables persistence", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          path: "/workspace/default-layout.json",
          updatedAt: "2026-03-22T09:00:00.000Z",
          layout: {
            version: 2,
            cols: 2,
            rows: 1,
            tiles: [0, 1],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const adapter = createOfficeLayoutPersistenceAdapter({
      config: {
        features: {
          logContentPersistenceEvents: false,
        },
        officeLayout: {
          persistenceMode: "development",
        },
      },
      fetch: fetchMock as typeof fetch,
    });

    expect(adapter.isAvailable).toBe(true);
    expect(adapter.id).toBe("development");
    await expect(adapter.load()).resolves.toMatchObject({
      sourcePath: "/workspace/default-layout.json",
      document: {
        version: 2,
        cols: 2,
        rows: 1,
        tiles: [0, 1],
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(OFFICE_LAYOUT_DEV_ROUTE, {
      headers: { Accept: "application/json" },
    });
  });

  test("wraps the Vite development endpoint behind a persistence adapter", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          path: "/workspace/default-layout.json",
          updatedAt: "2026-03-22T09:00:00.000Z",
          layout: {
            version: 2,
            cols: 2,
            rows: 1,
            tiles: [0, 1],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const adapter = createDevelopmentOfficeLayoutPersistenceAdapter({
      fetch: fetchMock as typeof fetch,
    });

    await expect(adapter.load()).resolves.toEqual({
      sourcePath: "/workspace/default-layout.json",
      updatedAt: "2026-03-22T09:00:00.000Z",
      document: {
        version: 2,
        cols: 2,
        rows: 1,
        tiles: [0, 1],
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(OFFICE_LAYOUT_DEV_ROUTE, {
      headers: { Accept: "application/json" },
    });
  });

  test("persists layout documents through the adapter and emits telemetry hooks", async () => {
    const events: Array<{ name: string; attributes?: Record<string, unknown> }> = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Response(
        JSON.stringify({
          path: "/workspace/default-layout.json",
          updatedAt: "2026-03-22T09:30:00.000Z",
          layout: JSON.parse(init?.body as string),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const adapter = createDevelopmentOfficeLayoutPersistenceAdapter({
      fetch: fetchMock as typeof fetch,
      telemetry: {
        track(event) {
          events.push(event);
        },
      },
    });

    const document = {
      version: 2,
      cols: 1,
      rows: 1,
      tiles: [0],
      furniture: [],
      characters: [],
    };

    await expect(adapter.save(document)).resolves.toMatchObject({
      sourcePath: "/workspace/default-layout.json",
      document,
    });
    expect(fetchMock).toHaveBeenCalledWith(OFFICE_LAYOUT_DEV_ROUTE, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(document),
    });
    expect(events.map((event) => event.name)).toEqual([
      "content.persistence.save.started",
      "content.persistence.save.succeeded",
    ]);
  });

  test("falls back to an unavailable adapter outside development mode", async () => {
    const adapter = createOfficeLayoutPersistenceAdapter({
      config: {
        features: {
          logContentPersistenceEvents: false,
        },
        officeLayout: {
          persistenceMode: "disabled",
        },
      },
    });

    expect(adapter.isAvailable).toBe(false);
    await expect(adapter.load()).rejects.toThrow(
      "Office layout persistence is not configured for this environment.",
    );
  });
});

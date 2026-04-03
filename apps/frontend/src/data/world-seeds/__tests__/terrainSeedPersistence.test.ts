import { describe, expect, test, vi } from "vitest";
import {
  TERRAIN_SEED_DEV_ROUTE,
  createDevelopmentTerrainSeedPersistenceAdapter,
  createTerrainSeedPersistenceAdapter,
} from "../terrainSeedPersistence";

describe("terrain seed persistence adapter", () => {
  test("selects the development adapter when config enables persistence", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            path: "/workspace/phase1.json",
            updatedAt: "2026-03-22T09:00:00.000Z",
            document: {
              width: 2,
              height: 1,
              chunkSize: 32,
              defaultMaterial: "grass",
              materials: ["grass", "water"],
              legend: {
                ".": "grass",
                "~": "water",
              },
              rows: [".."],
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
    );

    const adapter = createTerrainSeedPersistenceAdapter({
      mode: "development",
      fetch: fetchMock as typeof fetch,
    });

    expect(adapter.isAvailable).toBe(true);
    expect(adapter.id).toBe("development");
    await expect(adapter.load()).resolves.toMatchObject({
      sourcePath: "/workspace/phase1.json",
      document: {
        width: 2,
        height: 1,
        chunkSize: 32,
        defaultMaterial: "grass",
        rows: [".."],
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(TERRAIN_SEED_DEV_ROUTE, {
      headers: { Accept: "application/json" },
    });
  });

  test("persists terrain seed documents through the adapter and emits telemetry hooks", async () => {
    const events: Array<{
      name: string;
      attributes?: Record<string, unknown>;
    }> = [];
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Response(
          JSON.stringify({
            path: "/workspace/phase1.json",
            updatedAt: "2026-03-22T09:30:00.000Z",
            document: JSON.parse(init?.body as string),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
    );

    const adapter = createDevelopmentTerrainSeedPersistenceAdapter({
      fetch: fetchMock as typeof fetch,
      onEvent(event) {
        events.push(event);
      },
    });

    const document = {
      width: 2,
      height: 1,
      chunkSize: 32,
      defaultMaterial: "grass",
      materials: ["grass"],
      legend: {
        ".": "grass",
      },
      rows: [".."],
    };

    await expect(adapter.save(document)).resolves.toMatchObject({
      sourcePath: "/workspace/phase1.json",
      document,
    });
    expect(fetchMock).toHaveBeenCalledWith(TERRAIN_SEED_DEV_ROUTE, {
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

  test("accepts optional terrain detail layers in the persisted document shape", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            path: "/workspace/phase1.json",
            updatedAt: "2026-03-22T09:00:00.000Z",
            document: {
              width: 2,
              height: 1,
              chunkSize: 32,
              defaultMaterial: "grass",
              materials: ["grass", "water"],
              legend: {
                ".": "grass",
                "~": "water",
              },
              rows: [".."],
              terrainDetails: {
                legend: {
                  ".": null,
                  a: "public-assets:terrain/farmrpg-barn-posts",
                },
                rows: ["a."],
              },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
    );

    const adapter = createDevelopmentTerrainSeedPersistenceAdapter({
      fetch: fetchMock as typeof fetch,
    });

    await expect(adapter.load()).resolves.toMatchObject({
      document: {
        terrainDetails: {
          rows: ["a."],
        },
      },
    });
  });

  test("falls back to an unavailable adapter outside development mode", async () => {
    const adapter = createTerrainSeedPersistenceAdapter({
      mode: "disabled",
    });

    expect(adapter.isAvailable).toBe(false);
    await expect(adapter.load()).rejects.toThrow(
      "Terrain seed persistence is not configured for this environment.",
    );
  });
});

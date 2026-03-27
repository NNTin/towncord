import {
  TERRAIN_SEED_DEV_ROUTE,
  type TerrainSeedPersistenceAdapter,
  type TerrainSeedPersistenceEventSink,
  type TerrainSeedPersistenceMode,
  type TerrainSeedPersistenceSnapshot,
} from "./terrainSeedContracts";
export { TERRAIN_SEED_DEV_ROUTE } from "./terrainSeedContracts";
import {
  isTerrainSeedDocument,
  type TerrainSeedDocument,
} from "./terrainSeedDocument";

const TERRAIN_SEED_PERSISTENCE_UNAVAILABLE =
  "Terrain seed persistence is not configured for this environment.";

function emitPersistenceEvent(
  onEvent: TerrainSeedPersistenceEventSink | undefined,
  eventName: string,
  attributes?: Record<string, unknown>,
): void {
  onEvent?.({
    name: eventName,
    attributes: {
      contentId: "terrain-seed",
      ...attributes,
    },
  });
}

type FetchLike = typeof fetch;

type TerrainSeedApiResponse = {
  path: string;
  updatedAt: string;
  document: TerrainSeedDocument;
};

async function readJsonResponse(
  response: Response,
): Promise<TerrainSeedPersistenceSnapshot> {
  const payload = (await response.json()) as unknown;
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Terrain seed API returned an invalid payload.");
  }

  const candidate = payload as Partial<TerrainSeedApiResponse> & {
    error?: unknown;
  };
  if (!response.ok) {
    throw new Error(
      typeof candidate.error === "string"
        ? candidate.error
        : `Terrain seed request failed with ${response.status}.`,
    );
  }

  if (
    typeof candidate.path !== "string" ||
    typeof candidate.updatedAt !== "string" ||
    !isTerrainSeedDocument(candidate.document)
  ) {
    throw new Error("Terrain seed API response shape was invalid.");
  }

  return {
    sourcePath: candidate.path,
    updatedAt: candidate.updatedAt,
    document: candidate.document,
  };
}

export function createUnavailableTerrainSeedPersistenceAdapter(
  reason = TERRAIN_SEED_PERSISTENCE_UNAVAILABLE,
  onEvent?: TerrainSeedPersistenceEventSink,
): TerrainSeedPersistenceAdapter {
  const fail = async (): Promise<never> => {
    emitPersistenceEvent(onEvent, "content.persistence.unavailable", {
      adapterId: "disabled",
      reason,
    });
    throw new Error(reason);
  };

  return {
    id: "disabled",
    isAvailable: false,
    unavailableReason: reason,
    load: fail,
    save: fail,
  };
}

export function createDevelopmentTerrainSeedPersistenceAdapter(options: {
  fetch?: FetchLike;
  route?: string;
  onEvent?: TerrainSeedPersistenceEventSink;
} = {}): TerrainSeedPersistenceAdapter {
  const fetchImpl = options.fetch ?? fetch;
  const route = options.route ?? TERRAIN_SEED_DEV_ROUTE;

  return {
    id: "development",
    isAvailable: true,
    unavailableReason: null,
    async load() {
      emitPersistenceEvent(options.onEvent, "content.persistence.load.started", {
        adapterId: "development",
      });

      try {
        const snapshot = await readJsonResponse(
          await fetchImpl(route, {
            headers: { Accept: "application/json" },
          }),
        );

        emitPersistenceEvent(
          options.onEvent,
          "content.persistence.load.succeeded",
          {
            adapterId: "development",
            sourcePath: snapshot.sourcePath,
          },
        );
        return snapshot;
      } catch (error) {
        emitPersistenceEvent(options.onEvent, "content.persistence.load.failed", {
          adapterId: "development",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
      }
    },
    async save(document) {
      emitPersistenceEvent(options.onEvent, "content.persistence.save.started", {
        adapterId: "development",
      });

      try {
        const snapshot = await readJsonResponse(
          await fetchImpl(route, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(document),
          }),
        );

        emitPersistenceEvent(
          options.onEvent,
          "content.persistence.save.succeeded",
          {
            adapterId: "development",
            sourcePath: snapshot.sourcePath,
          },
        );
        return snapshot;
      } catch (error) {
        emitPersistenceEvent(options.onEvent, "content.persistence.save.failed", {
          adapterId: "development",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
      }
    },
  };
}

export function createTerrainSeedPersistenceAdapter(options: {
  mode: TerrainSeedPersistenceMode;
  fetch?: FetchLike;
  onEvent?: TerrainSeedPersistenceEventSink;
}): TerrainSeedPersistenceAdapter {
  if (options.mode === "development") {
    const adapterOptions: Parameters<
      typeof createDevelopmentTerrainSeedPersistenceAdapter
    >[0] = {};

    if (options.fetch) {
      adapterOptions.fetch = options.fetch;
    }
    if (options.onEvent) {
      adapterOptions.onEvent = options.onEvent;
    }

    return createDevelopmentTerrainSeedPersistenceAdapter(adapterOptions);
  }

  return createUnavailableTerrainSeedPersistenceAdapter(
    TERRAIN_SEED_PERSISTENCE_UNAVAILABLE,
    options.onEvent,
  );
}

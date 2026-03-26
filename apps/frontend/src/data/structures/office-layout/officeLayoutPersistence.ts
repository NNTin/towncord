import {
  OFFICE_LAYOUT_DEV_ROUTE,
  type OfficeLayoutPersistenceAdapter,
  type OfficeLayoutPersistenceEventSink,
  type OfficeLayoutPersistenceMode,
  type OfficeLayoutPersistenceSnapshot,
} from "./officeLayoutContracts";
import {
  isOfficeLayoutDocument,
  type OfficeLayoutDocument,
} from "./officeLayoutDocument";

export type { OfficeLayoutDocument };

type FetchLike = typeof fetch;

type OfficeLayoutApiResponse = {
  path: string;
  updatedAt: string;
  layout: OfficeLayoutDocument;
};

const OFFICE_LAYOUT_PERSISTENCE_UNAVAILABLE =
  "Office layout persistence is not configured for this environment.";

function emitPersistenceEvent(
  onEvent: OfficeLayoutPersistenceEventSink | undefined,
  eventName: string,
  attributes?: Record<string, unknown>,
): void {
  onEvent?.({
    name: eventName,
    attributes: {
      contentId: "office-layout",
      ...attributes,
    },
  });
}

async function readJsonResponse(
  response: Response,
): Promise<OfficeLayoutPersistenceSnapshot> {
  const payload = (await response.json()) as unknown;
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Office layout API returned an invalid payload.");
  }

  const candidate = payload as Partial<OfficeLayoutApiResponse> & {
    error?: unknown;
  };
  if (!response.ok) {
    throw new Error(
      typeof candidate.error === "string"
        ? candidate.error
        : `Office layout request failed with ${response.status}.`,
    );
  }

  if (
    typeof candidate.path !== "string" ||
    typeof candidate.updatedAt !== "string" ||
    !isOfficeLayoutDocument(candidate.layout)
  ) {
    throw new Error("Office layout API response shape was invalid.");
  }

  return {
    sourcePath: candidate.path,
    updatedAt: candidate.updatedAt,
    document: candidate.layout,
  };
}

export function createUnavailableOfficeLayoutPersistenceAdapter(
  reason = OFFICE_LAYOUT_PERSISTENCE_UNAVAILABLE,
  onEvent?: OfficeLayoutPersistenceEventSink,
): OfficeLayoutPersistenceAdapter {
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

export function createDevelopmentOfficeLayoutPersistenceAdapter(options: {
  fetch?: FetchLike;
  route?: string;
  onEvent?: OfficeLayoutPersistenceEventSink;
} = {}): OfficeLayoutPersistenceAdapter {
  const fetchImpl = options.fetch ?? fetch;
  const route = options.route ?? OFFICE_LAYOUT_DEV_ROUTE;

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

export function createOfficeLayoutPersistenceAdapter(options: {
  mode: OfficeLayoutPersistenceMode;
  fetch?: FetchLike;
  onEvent?: OfficeLayoutPersistenceEventSink;
}): OfficeLayoutPersistenceAdapter {
  if (options.mode === "development") {
    const adapterOptions: Parameters<
      typeof createDevelopmentOfficeLayoutPersistenceAdapter
    >[0] = {};

    if (options.fetch) {
      adapterOptions.fetch = options.fetch;
    }
    if (options.onEvent) {
      adapterOptions.onEvent = options.onEvent;
    }

    return createDevelopmentOfficeLayoutPersistenceAdapter(adapterOptions);
  }

  return createUnavailableOfficeLayoutPersistenceAdapter(
    OFFICE_LAYOUT_PERSISTENCE_UNAVAILABLE,
    options.onEvent,
  );
}

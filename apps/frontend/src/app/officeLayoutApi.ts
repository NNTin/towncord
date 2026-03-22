import { type FrontendConfig, frontendConfig } from "./frontendConfig";
import {
  type FrontendTelemetry,
  createNoopFrontendTelemetry,
  frontendTelemetry,
} from "./frontendTelemetry";
import {
  OFFICE_LAYOUT_DEV_ROUTE,
  type OfficeLayoutPersistenceAdapter,
  type OfficeLayoutPersistenceSnapshot,
} from "./officeLayoutContracts";
import { isOfficeLayoutDocument, type OfficeLayoutDocument } from "./officeLayoutDocument";

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
  telemetry: FrontendTelemetry,
  eventName: string,
  attributes?: Record<string, unknown>,
): void {
  telemetry.track({
    name: eventName,
    attributes: {
      contentId: "office-layout",
      ...attributes,
    },
  });
}

async function readJsonResponse(response: Response): Promise<OfficeLayoutPersistenceSnapshot> {
  const payload = (await response.json()) as unknown;
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Office layout API returned an invalid payload.");
  }

  const candidate = payload as Partial<OfficeLayoutApiResponse> & { error?: unknown };
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
  telemetry: FrontendTelemetry = createNoopFrontendTelemetry(),
): OfficeLayoutPersistenceAdapter {
  const fail = async (): Promise<never> => {
    emitPersistenceEvent(telemetry, "content.persistence.unavailable", {
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
  telemetry?: FrontendTelemetry;
} = {}): OfficeLayoutPersistenceAdapter {
  const fetchImpl = options.fetch ?? fetch;
  const route = options.route ?? OFFICE_LAYOUT_DEV_ROUTE;
  const telemetry = options.telemetry ?? createNoopFrontendTelemetry();

  return {
    id: "development",
    isAvailable: true,
    unavailableReason: null,
    async load() {
      emitPersistenceEvent(telemetry, "content.persistence.load.started", {
        adapterId: "development",
      });

      try {
        const snapshot = await readJsonResponse(
          await fetchImpl(route, {
            headers: { Accept: "application/json" },
          }),
        );

        emitPersistenceEvent(telemetry, "content.persistence.load.succeeded", {
          adapterId: "development",
          sourcePath: snapshot.sourcePath,
        });
        return snapshot;
      } catch (error) {
        emitPersistenceEvent(telemetry, "content.persistence.load.failed", {
          adapterId: "development",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
      }
    },
    async save(document) {
      emitPersistenceEvent(telemetry, "content.persistence.save.started", {
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

        emitPersistenceEvent(telemetry, "content.persistence.save.succeeded", {
          adapterId: "development",
          sourcePath: snapshot.sourcePath,
        });
        return snapshot;
      } catch (error) {
        emitPersistenceEvent(telemetry, "content.persistence.save.failed", {
          adapterId: "development",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
      }
    },
  };
}

export function createOfficeLayoutPersistenceAdapter(options: {
  config: FrontendConfig;
  fetch?: FetchLike;
  telemetry?: FrontendTelemetry;
}): OfficeLayoutPersistenceAdapter {
  if (options.config.officeLayout.persistenceMode === "development") {
    const adapterOptions: Parameters<
      typeof createDevelopmentOfficeLayoutPersistenceAdapter
    >[0] = {};

    if (options.fetch) {
      adapterOptions.fetch = options.fetch;
    }
    if (options.telemetry) {
      adapterOptions.telemetry = options.telemetry;
    }

    return createDevelopmentOfficeLayoutPersistenceAdapter({
      ...adapterOptions,
    });
  }

  return createUnavailableOfficeLayoutPersistenceAdapter(
    OFFICE_LAYOUT_PERSISTENCE_UNAVAILABLE,
    options.telemetry,
  );
}

export const officeLayoutPersistence = createOfficeLayoutPersistenceAdapter({
  config: frontendConfig,
  telemetry: frontendTelemetry,
});

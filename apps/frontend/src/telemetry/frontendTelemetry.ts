import { frontendConfig } from "../config";

export type FrontendTelemetryEvent = {
  name: string;
  attributes?: Record<string, unknown>;
};

export interface FrontendTelemetry {
  track(event: FrontendTelemetryEvent): void;
}

type Logger = Pick<Console, "info">;

export function createNoopFrontendTelemetry(): FrontendTelemetry {
  return {
    track() {
      // Intentionally empty in environments without a telemetry sink.
    },
  };
}

export function createDevelopmentTelemetry(options: {
  enabled: boolean;
  logger?: Logger;
}): FrontendTelemetry {
  if (!options.enabled) {
    return createNoopFrontendTelemetry();
  }

  const logger = options.logger ?? console;

  return {
    track(event) {
      logger.info("[frontend telemetry]", event.name, event.attributes ?? {});
    },
  };
}

export const frontendTelemetry = createDevelopmentTelemetry({
  enabled: frontendConfig.features.logContentPersistenceEvents,
});

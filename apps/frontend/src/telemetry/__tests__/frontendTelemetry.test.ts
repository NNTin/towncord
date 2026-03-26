import { describe, expect, test, vi } from "vitest";
import { createDevelopmentTelemetry } from "../frontendTelemetry";

describe("frontendTelemetry", () => {
  test("logs events only when telemetry is explicitly enabled", () => {
    const logger = {
      info: vi.fn(),
    };

    createDevelopmentTelemetry({
      enabled: false,
      logger,
    }).track({
      name: "content.persistence.load.started",
      attributes: {
        adapterId: "development",
      },
    });

    expect(logger.info).not.toHaveBeenCalled();

    createDevelopmentTelemetry({
      enabled: true,
      logger,
    }).track({
      name: "content.persistence.load.started",
      attributes: {
        adapterId: "development",
      },
    });

    expect(logger.info).toHaveBeenCalledWith(
      "[frontend telemetry]",
      "content.persistence.load.started",
      {
        adapterId: "development",
      },
    );
  });
});

import { describe, expect, test } from "vitest";
import { createFrontendConfig } from "../frontendConfig";

describe("frontendConfig", () => {
  test("enables development persistence only for development builds", () => {
    expect(createFrontendConfig({ DEV: true })).toEqual({
      features: {
        debugUiEnabledByDefault: true,
        logContentPersistenceEvents: false,
      },
      officeLayout: {
        persistenceMode: "development",
      },
      terrainSeed: {
        persistenceMode: "development",
      },
    });

    expect(createFrontendConfig({ DEV: false })).toEqual({
      features: {
        debugUiEnabledByDefault: false,
        logContentPersistenceEvents: false,
      },
      officeLayout: {
        persistenceMode: "disabled",
      },
      terrainSeed: {
        persistenceMode: "disabled",
      },
    });
  });
});

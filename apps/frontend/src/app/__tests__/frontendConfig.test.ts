import { describe, expect, test } from "vitest";
import { createFrontendConfig } from "../frontendConfig";

describe("frontendConfig", () => {
  test("enables development persistence only for development builds", () => {
    expect(createFrontendConfig({ DEV: true })).toEqual({
      features: {
        logContentPersistenceEvents: false,
      },
      officeLayout: {
        persistenceMode: "development",
      },
    });

    expect(createFrontendConfig({ DEV: false })).toEqual({
      features: {
        logContentPersistenceEvents: false,
      },
      officeLayout: {
        persistenceMode: "disabled",
      },
    });
  });
});

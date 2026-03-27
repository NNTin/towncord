export type FrontendConfig = {
  features: {
    logContentPersistenceEvents: boolean;
  };
  officeLayout: {
    persistenceMode: "development" | "disabled";
  };
  terrainSeed: {
    persistenceMode: "development" | "disabled";
  };
};

type FrontendEnv = Pick<ImportMetaEnv, "DEV">;

export function createFrontendConfig(env: FrontendEnv): FrontendConfig {
  return {
    features: {
      logContentPersistenceEvents: false,
    },
    officeLayout: {
      persistenceMode: env.DEV ? "development" : "disabled",
    },
    terrainSeed: {
      persistenceMode: env.DEV ? "development" : "disabled",
    },
  };
}

export const frontendConfig = createFrontendConfig(import.meta.env);

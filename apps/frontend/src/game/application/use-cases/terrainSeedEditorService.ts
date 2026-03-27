import {
  createTerrainSeedPersistenceAdapter,
  type TerrainSeedDocument,
  type TerrainSeedPersistenceAdapter,
  type TerrainSeedPersistenceSnapshot,
} from "../../../data";
import { frontendConfig } from "../../../config";
import { frontendTelemetry } from "../../../telemetry";

export type {
  TerrainSeedDocument,
  TerrainSeedPersistenceAdapter,
  TerrainSeedPersistenceSnapshot,
} from "../../../data";

const terrainSeedPersistence = createTerrainSeedPersistenceAdapter({
  mode: frontendConfig.terrainSeed.persistenceMode,
  onEvent: (event) => frontendTelemetry.track(event),
});

export type TerrainSeedEditorService = {
  isAvailable: boolean;
  unavailableReason: string | null;
  load: () => Promise<TerrainSeedPersistenceSnapshot>;
  save: (
    document: TerrainSeedDocument,
  ) => Promise<TerrainSeedPersistenceSnapshot>;
};

export function createTerrainSeedEditorService(
  persistence: TerrainSeedPersistenceAdapter = terrainSeedPersistence,
): TerrainSeedEditorService {
  return {
    get isAvailable() {
      return persistence.isAvailable;
    },
    get unavailableReason() {
      return persistence.unavailableReason;
    },
    load: () => persistence.load(),
    save: (document) => persistence.save(document),
  };
}

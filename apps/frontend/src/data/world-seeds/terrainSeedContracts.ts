export const TERRAIN_SEED_DEV_ROUTE = "/__terrain-seed";

export type TerrainSeedPersistenceMode = "development" | "disabled";

export type TerrainSeedPersistenceEvent = {
  name: string;
  attributes?: Record<string, unknown>;
};

export type TerrainSeedPersistenceEventSink = (
  event: TerrainSeedPersistenceEvent,
) => void;

export type TerrainSeedPersistenceSnapshot = {
  document: import("./terrainSeedDocument").TerrainSeedDocument;
  sourcePath: string;
  updatedAt: string;
};

export interface TerrainSeedPersistenceAdapter {
  readonly id: string;
  readonly isAvailable: boolean;
  readonly unavailableReason: string | null;
  load(): Promise<TerrainSeedPersistenceSnapshot>;
  save(
    document: import("./terrainSeedDocument").TerrainSeedDocument,
  ): Promise<TerrainSeedPersistenceSnapshot>;
}

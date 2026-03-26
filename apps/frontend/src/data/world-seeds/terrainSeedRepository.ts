import type { ReadonlyDocumentRepository } from "../contracts";
import { createUnavailableReadonlyDocumentRepository } from "../shared";
import type { TerrainSeedDocument } from "./terrainSeedDocument";

export const TERRAIN_SEED_REPOSITORY_UNAVAILABLE =
  "World seed repositories are not implemented in the frontend data boundary yet.";

export interface TerrainSeedRepository
  extends ReadonlyDocumentRepository<TerrainSeedDocument> {}

export const terrainSeedRepository =
  createUnavailableReadonlyDocumentRepository<TerrainSeedDocument>({
    id: "terrain-seed-unavailable",
    reason: TERRAIN_SEED_REPOSITORY_UNAVAILABLE,
  });

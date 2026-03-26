import type { ReadonlyDocumentRepository } from "../contracts";
import { createUnavailableReadonlyDocumentRepository } from "../shared";
import type { TerrainRulesetFile } from "./terrainRulesetDocument";

export const TERRAIN_RULESET_REPOSITORY_UNAVAILABLE =
  "Terrain ruleset repositories are not implemented in the frontend data boundary yet.";

export interface TerrainRulesetRepository
  extends ReadonlyDocumentRepository<TerrainRulesetFile> {}

export const terrainRulesetRepository =
  createUnavailableReadonlyDocumentRepository<TerrainRulesetFile>({
    id: "terrain-ruleset-unavailable",
    reason: TERRAIN_RULESET_REPOSITORY_UNAVAILABLE,
  });

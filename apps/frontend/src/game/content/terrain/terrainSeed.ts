import type { TerrainSeedDocument } from "../../../data";
import { terrainContentRepository } from "../asset-catalog/terrainContentRepository";

export type { TerrainSeedDocument } from "../../../data";

export const defaultTerrainSeed =
  terrainContentRepository.read().seed as TerrainSeedDocument;

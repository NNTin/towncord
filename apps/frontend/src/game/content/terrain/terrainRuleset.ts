import type { TerrainRulesetFile } from "../../../data";
import { terrainContentRepository } from "../asset-catalog/terrainContentRepository";

export type {
  MarchingCaseRule,
  TerrainTransitionRuleset,
  TerrainRulesetFile,
} from "../../../data";

export const defaultTerrainRuleset =
  terrainContentRepository.read().ruleset as TerrainRulesetFile;

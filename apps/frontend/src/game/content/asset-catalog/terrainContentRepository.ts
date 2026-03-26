import type {
  TerrainRulesetFile,
  TerrainSeedDocument,
} from "../../../data";
import type { ContentRepository } from "../../contracts/contentInterfaces";
import terrainRulesetJson from "public-assets-json:terrain/rulesets/phase1.json";
import terrainSeedJson from "public-assets-json:terrain/seeds/phase1.json";

export type TerrainContent = {
  sourceId: string;
  seed: TerrainSeedDocument;
  ruleset: TerrainRulesetFile;
};

export interface TerrainContentRepository
  extends ContentRepository<TerrainContent> {}

const DEFAULT_TERRAIN_CONTENT: TerrainContent = {
  sourceId: "public-assets:terrain/phase1",
  seed: terrainSeedJson as TerrainSeedDocument,
  ruleset: terrainRulesetJson as TerrainRulesetFile,
};

export function createStaticTerrainContentRepository(
  content: TerrainContent = DEFAULT_TERRAIN_CONTENT,
): TerrainContentRepository {
  return {
    read() {
      return {
        sourceId: content.sourceId,
        seed: structuredClone(content.seed),
        ruleset: structuredClone(content.ruleset),
      };
    },
  };
}

export const terrainContentRepository = createStaticTerrainContentRepository();

import type { TerrainRulesetFile, TerrainSeedDocument } from "../../../data";
import type { ContentRepository } from "../../contracts/contentInterfaces";
import { TERRAIN_TEXTURE_KEY } from "../../terrain/contracts";
import farmrpgTerrainRulesetJson from "public-assets-json:terrain/rulesets/farmrpg-grass.json";
import terrainRulesetJson from "public-assets-json:terrain/rulesets/phase1.json";
import terrainSeedJson from "public-assets-json:terrain/seeds/phase1.json";

export const DEFAULT_TERRAIN_SOURCE_ID = "public-assets:terrain/phase1";
export const FARMRPG_GRASS_TERRAIN_SOURCE_ID =
  "public-assets:terrain/farmrpg-grass";

export type TerrainContentSourceId =
  | typeof DEFAULT_TERRAIN_SOURCE_ID
  | typeof FARMRPG_GRASS_TERRAIN_SOURCE_ID;

export type TerrainContent = {
  sourceId: TerrainContentSourceId;
  seed: TerrainSeedDocument;
  ruleset: TerrainRulesetFile;
  textureKey: typeof TERRAIN_TEXTURE_KEY | "farmrpg.tilesets";
};

export interface TerrainContentRepository extends ContentRepository<TerrainContent> {}

const DEFAULT_TERRAIN_CONTENT: TerrainContent = {
  sourceId: DEFAULT_TERRAIN_SOURCE_ID,
  seed: terrainSeedJson as TerrainSeedDocument,
  ruleset: terrainRulesetJson as TerrainRulesetFile,
  textureKey: TERRAIN_TEXTURE_KEY,
};

const FARMRPG_GRASS_TERRAIN_CONTENT: TerrainContent = {
  sourceId: FARMRPG_GRASS_TERRAIN_SOURCE_ID,
  seed: terrainSeedJson as TerrainSeedDocument,
  ruleset: farmrpgTerrainRulesetJson as TerrainRulesetFile,
  textureKey: "farmrpg.tilesets",
};

const TERRAIN_CONTENT_BY_SOURCE_ID: Record<
  TerrainContentSourceId,
  TerrainContent
> = {
  [DEFAULT_TERRAIN_SOURCE_ID]: DEFAULT_TERRAIN_CONTENT,
  [FARMRPG_GRASS_TERRAIN_SOURCE_ID]: FARMRPG_GRASS_TERRAIN_CONTENT,
};

export const ALL_TERRAIN_SOURCE_IDS: readonly TerrainContentSourceId[] = [
  DEFAULT_TERRAIN_SOURCE_ID,
  FARMRPG_GRASS_TERRAIN_SOURCE_ID,
];

function cloneTerrainContent(content: TerrainContent): TerrainContent {
  return {
    sourceId: content.sourceId,
    seed: structuredClone(content.seed),
    ruleset: structuredClone(content.ruleset),
    textureKey: content.textureKey,
  };
}

export function readTerrainContent(
  sourceId: TerrainContentSourceId = DEFAULT_TERRAIN_SOURCE_ID,
): TerrainContent {
  const content = TERRAIN_CONTENT_BY_SOURCE_ID[sourceId];
  if (!content) {
    throw new Error(`Unknown terrain content source "${sourceId}".`);
  }

  return cloneTerrainContent(content);
}

export function createStaticTerrainContentRepository(
  content: TerrainContent = DEFAULT_TERRAIN_CONTENT,
): TerrainContentRepository {
  return {
    read() {
      return cloneTerrainContent(content);
    },
  };
}

export const terrainContentRepository = createStaticTerrainContentRepository();

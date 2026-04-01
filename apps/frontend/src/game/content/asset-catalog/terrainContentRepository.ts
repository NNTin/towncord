import type { TerrainRulesetFile, TerrainSeedDocument } from "../../../data";
import type { ContentRepository } from "../../contracts/contentInterfaces";
import { TERRAIN_TEXTURE_KEY } from "../../terrain/contracts";
import farmrpgTerrainRulesetJson from "public-assets-json:terrain/rulesets/farmrpg-grass.json";
import terrainRulesetJson from "public-assets-json:terrain/rulesets/phase1.json";
import terrainSeedJson from "public-assets-json:terrain/seeds/phase1.json";

export const PHASE1_TERRAIN_SOURCE_ID = "public-assets:terrain/phase1";
export const FARMRPG_GRASS_TERRAIN_SOURCE_ID =
  "public-assets:terrain/farmrpg-grass";
export const DEFAULT_TERRAIN_SOURCE_ID = FARMRPG_GRASS_TERRAIN_SOURCE_ID;

export type TerrainContentSourceId =
  | typeof PHASE1_TERRAIN_SOURCE_ID
  | typeof FARMRPG_GRASS_TERRAIN_SOURCE_ID;

export type TerrainTextureKey = typeof TERRAIN_TEXTURE_KEY | "debug.tilesets";

export type TerrainContent<
  TSourceId extends string = TerrainContentSourceId,
  TTextureKey extends string = TerrainTextureKey,
> = {
  sourceId: TSourceId;
  seed: TerrainSeedDocument;
  ruleset: TerrainRulesetFile;
  textureKey: TTextureKey;
};

export interface TerrainContentRepository<
  TContent extends TerrainContent<string, string> = TerrainContent,
> extends ContentRepository<TContent> {}

const PHASE1_TERRAIN_CONTENT: TerrainContent = {
  sourceId: PHASE1_TERRAIN_SOURCE_ID,
  seed: terrainSeedJson as TerrainSeedDocument,
  ruleset: terrainRulesetJson as TerrainRulesetFile,
  textureKey: "debug.tilesets",
};

const FARMRPG_GRASS_TERRAIN_CONTENT: TerrainContent = {
  sourceId: FARMRPG_GRASS_TERRAIN_SOURCE_ID,
  seed: terrainSeedJson as TerrainSeedDocument,
  ruleset: farmrpgTerrainRulesetJson as TerrainRulesetFile,
  textureKey: TERRAIN_TEXTURE_KEY,
};

const DEFAULT_TERRAIN_CONTENT = FARMRPG_GRASS_TERRAIN_CONTENT;

const TERRAIN_CONTENT_BY_SOURCE_ID: Record<
  TerrainContentSourceId,
  TerrainContent
> = {
  [PHASE1_TERRAIN_SOURCE_ID]: PHASE1_TERRAIN_CONTENT,
  [FARMRPG_GRASS_TERRAIN_SOURCE_ID]: FARMRPG_GRASS_TERRAIN_CONTENT,
};

export const ALL_TERRAIN_SOURCE_IDS: readonly TerrainContentSourceId[] = [
  DEFAULT_TERRAIN_SOURCE_ID,
  PHASE1_TERRAIN_SOURCE_ID,
];

function cloneTerrainContent<TContent extends TerrainContent<string, string>>(
  content: TContent,
): TContent {
  return {
    sourceId: content.sourceId,
    seed: structuredClone(content.seed),
    ruleset: structuredClone(content.ruleset),
    textureKey: content.textureKey,
  } as TContent;
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

export function createStaticTerrainContentRepository<
  TContent extends TerrainContent<string, string> = TerrainContent,
>(content?: TContent): TerrainContentRepository<TContent> {
  const resolvedContent = (content ?? DEFAULT_TERRAIN_CONTENT) as TContent;

  return {
    read() {
      return cloneTerrainContent(resolvedContent);
    },
  };
}

export const terrainContentRepository = createStaticTerrainContentRepository();

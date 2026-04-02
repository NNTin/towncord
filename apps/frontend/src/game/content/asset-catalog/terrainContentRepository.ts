import type { TerrainRulesetFile, TerrainSeedDocument } from "../../../data";
import type { ContentRepository } from "../../contracts/contentInterfaces";
import { TERRAIN_TEXTURE_KEY } from "../../terrain/contracts";
import farmrpgTerrainRulesetJson from "public-assets-json:terrain/rulesets/farmrpg-grass.json";
import terrainRulesetJson from "public-assets-json:terrain/rulesets/phase1.json";
import terrainSeedJson from "public-assets-json:terrain/seeds/phase1.json";
import {
  FARMRPG_STATIC_TERRAIN_SOURCE_SPECS,
  createFarmrpgAutotileRuleset,
  type FarmrpgStaticTerrainSourceId,
} from "./farmrpgTerrainSourceCatalog";

export const PHASE1_TERRAIN_SOURCE_ID = "public-assets:terrain/phase1";

export const FARMRPG_GRASS_TERRAIN_SOURCE_IDS = {
  spring: "public-assets:terrain/farmrpg-grass",
  summer: "public-assets:terrain/farmrpg-grass-summer",
  fall: "public-assets:terrain/farmrpg-grass-fall",
  winter: "public-assets:terrain/farmrpg-grass-winter",
} as const;

export type FarmrpgTerrainSeason =
  keyof typeof FARMRPG_GRASS_TERRAIN_SOURCE_IDS;

export const FARMRPG_GRASS_TERRAIN_SOURCE_ID =
  FARMRPG_GRASS_TERRAIN_SOURCE_IDS.spring;
export const DEFAULT_TERRAIN_SOURCE_ID = FARMRPG_GRASS_TERRAIN_SOURCE_ID;

export type FarmrpgTerrainSourceId =
  (typeof FARMRPG_GRASS_TERRAIN_SOURCE_IDS)[FarmrpgTerrainSeason];

export type TerrainContentSourceId =
  | typeof PHASE1_TERRAIN_SOURCE_ID
  | FarmrpgTerrainSourceId
  | FarmrpgStaticTerrainSourceId;

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

function createFarmrpgTerrainRuleset(
  season: FarmrpgTerrainSeason,
): TerrainRulesetFile {
  const ruleset = structuredClone(
    farmrpgTerrainRulesetJson,
  ) as TerrainRulesetFile;
  if (season === "spring") {
    return ruleset;
  }

  const sourcePrefix = "tilesets.farmrpg.grass-water.spring#";
  const targetPrefix = `tilesets.farmrpg.grass-water.${season}#`;

  for (const transition of ruleset.transitions) {
    transition.id = transition.id.replace("spring", season);
    for (const rule of transition.rules) {
      if (rule.frame.startsWith(sourcePrefix)) {
        rule.frame = `${targetPrefix}${rule.frame.slice(sourcePrefix.length)}`;
      }
    }
  }

  return ruleset;
}

const FARMRPG_TERRAIN_CONTENT_BY_SOURCE_ID: Record<
  FarmrpgTerrainSourceId,
  TerrainContent
> = {
  [FARMRPG_GRASS_TERRAIN_SOURCE_IDS.spring]: {
    sourceId: FARMRPG_GRASS_TERRAIN_SOURCE_IDS.spring,
    seed: terrainSeedJson as TerrainSeedDocument,
    ruleset: createFarmrpgTerrainRuleset("spring"),
    textureKey: TERRAIN_TEXTURE_KEY,
  },
  [FARMRPG_GRASS_TERRAIN_SOURCE_IDS.summer]: {
    sourceId: FARMRPG_GRASS_TERRAIN_SOURCE_IDS.summer,
    seed: terrainSeedJson as TerrainSeedDocument,
    ruleset: createFarmrpgTerrainRuleset("summer"),
    textureKey: TERRAIN_TEXTURE_KEY,
  },
  [FARMRPG_GRASS_TERRAIN_SOURCE_IDS.fall]: {
    sourceId: FARMRPG_GRASS_TERRAIN_SOURCE_IDS.fall,
    seed: terrainSeedJson as TerrainSeedDocument,
    ruleset: createFarmrpgTerrainRuleset("fall"),
    textureKey: TERRAIN_TEXTURE_KEY,
  },
  [FARMRPG_GRASS_TERRAIN_SOURCE_IDS.winter]: {
    sourceId: FARMRPG_GRASS_TERRAIN_SOURCE_IDS.winter,
    seed: terrainSeedJson as TerrainSeedDocument,
    ruleset: createFarmrpgTerrainRuleset("winter"),
    textureKey: TERRAIN_TEXTURE_KEY,
  },
};

const FARMRPG_STATIC_TERRAIN_CONTENT_BY_SOURCE_ID: Record<
  FarmrpgStaticTerrainSourceId,
  TerrainContent
> = Object.fromEntries(
  FARMRPG_STATIC_TERRAIN_SOURCE_SPECS.map((spec) => [
    spec.sourceId,
    {
      sourceId: spec.sourceId,
      seed: terrainSeedJson as TerrainSeedDocument,
      ruleset: createFarmrpgAutotileRuleset(spec.framePrefix),
      textureKey: TERRAIN_TEXTURE_KEY,
    },
  ]),
) as Record<FarmrpgStaticTerrainSourceId, TerrainContent>;

const DEFAULT_TERRAIN_CONTENT =
  FARMRPG_TERRAIN_CONTENT_BY_SOURCE_ID[DEFAULT_TERRAIN_SOURCE_ID];

const TERRAIN_CONTENT_BY_SOURCE_ID: Record<
  TerrainContentSourceId,
  TerrainContent
> = {
  [PHASE1_TERRAIN_SOURCE_ID]: PHASE1_TERRAIN_CONTENT,
  ...FARMRPG_TERRAIN_CONTENT_BY_SOURCE_ID,
  ...FARMRPG_STATIC_TERRAIN_CONTENT_BY_SOURCE_ID,
};

export const ALL_TERRAIN_SOURCE_IDS: readonly TerrainContentSourceId[] = [
  DEFAULT_TERRAIN_SOURCE_ID,
  FARMRPG_GRASS_TERRAIN_SOURCE_IDS.summer,
  FARMRPG_GRASS_TERRAIN_SOURCE_IDS.fall,
  FARMRPG_GRASS_TERRAIN_SOURCE_IDS.winter,
  ...FARMRPG_STATIC_TERRAIN_SOURCE_SPECS.map((spec) => spec.sourceId),
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

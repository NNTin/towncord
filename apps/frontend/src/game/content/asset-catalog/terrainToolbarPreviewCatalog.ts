import terrainRulesetJson from "public-assets-json:terrain/rulesets/phase1.json";
import farmrpgTerrainRulesetJson from "public-assets-json:terrain/rulesets/farmrpg-grass.json";
import type { TerrainRulesetFile } from "../../../data";
import {
  FARMRPG_GRASS_TERRAIN_SOURCE_IDS,
  FARMRPG_GRASS_TERRAIN_SOURCE_ID,
  type FarmrpgTerrainSeason,
  PHASE1_TERRAIN_SOURCE_ID,
  type TerrainContentSourceId,
} from "./terrainContentRepository";
import {
  FARMRPG_STATIC_TERRAIN_SOURCE_SPECS,
  createFarmrpgAutotileRuleset,
} from "./farmrpgTerrainSourceCatalog";
import {
  DEFAULT_TERRAIN_ANIMATION_FRAME_MS,
  type TerrainBrushId,
  type TerrainMaterialId,
} from "../../terrain/contracts";
import {
  DEBUG_TERRAIN_ATLAS_FRAMES,
  DEBUG_TERRAIN_ATLAS_IMAGE_URL,
  DEBUG_TERRAIN_ATLAS_W,
  DEBUG_TERRAIN_ATLAS_H,
} from "./debugTerrainAtlas";
import {
  FARMRPG_TERRAIN_ATLAS_FRAMES,
  FARMRPG_TERRAIN_ATLAS_IMAGE_URL,
  FARMRPG_TERRAIN_ATLAS_W,
  FARMRPG_TERRAIN_ATLAS_H,
} from "./farmrpgTerrainAtlas";

export { DEFAULT_TERRAIN_ANIMATION_FRAME_MS };

export type TerrainToolbarPreviewFrame = {
  frameKey: string;
  atlasFrame: { x: number; y: number; w: number; h: number };
  atlasImageUrl: string;
  atlasW: number;
  atlasH: number;
};

export type TerrainToolbarPreviewItem = {
  terrainSourceId?: TerrainContentSourceId;
  /** When `true`, this item applies to any active terrain source (e.g. "Clear Terrain"). */
  isSourceAgnostic?: true;
  id: string;
  label: string;
  materialId: TerrainMaterialId;
  brushId: TerrainBrushId;
  groupKey: string;
  groupLabel: string;
  representativeFrame: TerrainToolbarPreviewFrame;
  animationFrames: TerrainToolbarPreviewFrame[];
};

type TerrainRulesetTransitionRule = {
  caseId: number;
  frame: string;
};

type AtlasSource = {
  frames: Record<
    string,
    { frame: { x: number; y: number; w: number; h: number } }
  >;
  imageUrl: string;
  w: number;
  h: number;
};

const DEBUG_ATLAS_SOURCE: AtlasSource = {
  frames: DEBUG_TERRAIN_ATLAS_FRAMES,
  imageUrl: DEBUG_TERRAIN_ATLAS_IMAGE_URL,
  w: DEBUG_TERRAIN_ATLAS_W,
  h: DEBUG_TERRAIN_ATLAS_H,
};

const FARMRPG_ATLAS_SOURCE: AtlasSource = {
  frames: FARMRPG_TERRAIN_ATLAS_FRAMES,
  imageUrl: FARMRPG_TERRAIN_ATLAS_IMAGE_URL,
  w: FARMRPG_TERRAIN_ATLAS_W,
  h: FARMRPG_TERRAIN_ATLAS_H,
};

function resolvePreviewFrame(
  rule: TerrainRulesetTransitionRule,
  atlas: AtlasSource,
): TerrainToolbarPreviewFrame {
  const atlasEntry = atlas.frames[rule.frame];
  if (!atlasEntry) {
    throw new Error(
      `Missing terrain atlas frame "${rule.frame}" in atlas "${atlas.imageUrl}".`,
    );
  }

  return {
    frameKey: rule.frame,
    atlasFrame: atlasEntry.frame,
    atlasImageUrl: atlas.imageUrl,
    atlasW: atlas.w,
    atlasH: atlas.h,
  };
}

function resolveAnimatedPreviewFrames(
  baseFrameKey: string,
  atlas: AtlasSource,
): TerrainToolbarPreviewFrame[] {
  const frames: TerrainToolbarPreviewFrame[] = [];

  for (let phase = 0; phase < 256; phase += 1) {
    const frameKey = `${baseFrameKey}@${phase}`;
    const atlasEntry = atlas.frames[frameKey];
    if (!atlasEntry) {
      break;
    }

    frames.push({
      frameKey,
      atlasFrame: atlasEntry.frame,
      atlasImageUrl: atlas.imageUrl,
      atlasW: atlas.w,
      atlasH: atlas.h,
    });
  }

  if (frames.length === 0) {
    const atlasEntry = atlas.frames[baseFrameKey];
    if (atlasEntry) {
      frames.push({
        frameKey: baseFrameKey,
        atlasFrame: atlasEntry.frame,
        atlasImageUrl: atlas.imageUrl,
        atlasW: atlas.w,
        atlasH: atlas.h,
      });
    }
  }

  return frames;
}

function resolveTransitionRules(): TerrainRulesetTransitionRule[] {
  return resolveTransitionRulesFromRuleset(terrainRulesetJson);
}

function createTerrainToolbarPreviewItem(input: {
  terrainSourceId?: TerrainContentSourceId;
  isSourceAgnostic?: true;
  id: string;
  label: string;
  materialId: TerrainMaterialId;
  brushId: TerrainBrushId;
  representativeCaseId: number;
  groupKey?: string;
  groupLabel?: string;
  rules: TerrainRulesetTransitionRule[];
  atlas: AtlasSource;
}): TerrainToolbarPreviewItem {
  const representativeRule =
    input.rules.find((rule) => rule.caseId === input.representativeCaseId) ??
    input.rules[0];
  if (!representativeRule) {
    throw new Error(
      `Terrain preview item "${input.id}" requires at least one rule.`,
    );
  }

  const representativeFrame = resolvePreviewFrame(
    representativeRule,
    input.atlas,
  );
  return {
    ...(input.terrainSourceId
      ? { terrainSourceId: input.terrainSourceId }
      : {}),
    ...(input.isSourceAgnostic && { isSourceAgnostic: true }),
    id: input.id,
    label: input.label,
    materialId: input.materialId,
    brushId: input.brushId,
    groupKey: input.groupKey ?? "terrain",
    groupLabel: input.groupLabel ?? "Terrain",
    representativeFrame,
    animationFrames: resolveAnimatedPreviewFrames(
      representativeFrame.frameKey,
      input.atlas,
    ),
  };
}

function resolveTransitionRulesFromRuleset(
  rulesetJson: unknown,
): TerrainRulesetTransitionRule[] {
  const terrainRuleset = rulesetJson as TerrainRulesetFile;
  const transition = terrainRuleset.transitions[0];
  if (!transition) {
    throw new Error("Terrain ruleset must define at least one transition.");
  }

  return [...transition.rules].sort(
    (left, right) => left.caseId - right.caseId,
  );
}

const TERRAIN_PREVIEW_RULES = resolveTransitionRules();
const FARMRPG_TERRAIN_PREVIEW_RULES = resolveTransitionRulesFromRuleset(
  farmrpgTerrainRulesetJson,
);
const FARMRPG_WATER_TILE_PREVIEW_RULES: TerrainRulesetTransitionRule[] = [
  {
    caseId: 0,
    frame: "tilesets.farmrpg.water.tile#0",
  },
];
const FARMRPG_DELETE_PREVIEW_RULES: TerrainRulesetTransitionRule[] = [
  {
    caseId: 0,
    frame: "tilesets.farmrpg.grass.spring#0",
  },
];

const FARMRPG_TERRAIN_PREVIEW_VARIANTS: ReadonlyArray<{
  season: FarmrpgTerrainSeason;
  label: string;
  terrainSourceId: TerrainContentSourceId;
}> = [
  {
    season: "spring",
    label: "Spring",
    terrainSourceId: FARMRPG_GRASS_TERRAIN_SOURCE_IDS.spring,
  },
  {
    season: "summer",
    label: "Summer",
    terrainSourceId: FARMRPG_GRASS_TERRAIN_SOURCE_IDS.summer,
  },
  {
    season: "fall",
    label: "Fall",
    terrainSourceId: FARMRPG_GRASS_TERRAIN_SOURCE_IDS.fall,
  },
  {
    season: "winter",
    label: "Winter",
    terrainSourceId: FARMRPG_GRASS_TERRAIN_SOURCE_IDS.winter,
  },
];

function remapFramePrefix(
  rules: TerrainRulesetTransitionRule[],
  sourcePrefix: string,
  targetPrefix: string,
): TerrainRulesetTransitionRule[] {
  return rules.map((rule) => ({
    caseId: rule.caseId,
    frame: rule.frame.startsWith(sourcePrefix)
      ? `${targetPrefix}${rule.frame.slice(sourcePrefix.length)}`
      : rule.frame,
  }));
}

function resolveFarmrpgGroundRules(
  season: FarmrpgTerrainSeason,
): TerrainRulesetTransitionRule[] {
  return remapFramePrefix(
    FARMRPG_TERRAIN_PREVIEW_RULES,
    "tilesets.farmrpg.grass-water.spring#",
    `tilesets.farmrpg.grass.${season}#`,
  );
}

export const TERRAIN_TOOLBAR_PREVIEW_ITEMS: TerrainToolbarPreviewItem[] = [
  createTerrainToolbarPreviewItem({
    terrainSourceId: PHASE1_TERRAIN_SOURCE_ID,
    id: "terrain.water.tile",
    label: "Water Tile Brush",
    materialId: "water",
    brushId: "water",
    representativeCaseId: 15,
    rules: TERRAIN_PREVIEW_RULES,
    atlas: DEBUG_ATLAS_SOURCE,
  }),
  createTerrainToolbarPreviewItem({
    terrainSourceId: PHASE1_TERRAIN_SOURCE_ID,
    id: "terrain.ground.tile",
    label: "Ground Tile Brush",
    materialId: "ground",
    brushId: "ground",
    representativeCaseId: 0,
    rules: TERRAIN_PREVIEW_RULES,
    atlas: DEBUG_ATLAS_SOURCE,
  }),
];

function buildFarmrpgTerrainToolbarPreviewItems(): TerrainToolbarPreviewItem[] {
  const previewItems: TerrainToolbarPreviewItem[] = [];

  for (const variant of FARMRPG_TERRAIN_PREVIEW_VARIANTS) {
    try {
      const groundRules = resolveFarmrpgGroundRules(variant.season);

      previewItems.push(
        createTerrainToolbarPreviewItem({
          terrainSourceId: variant.terrainSourceId,
          id: `terrain.farmrpg.${variant.season}.water.tile`,
          label: `FarmRPG ${variant.label} Water Tile Brush`,
          materialId: "water",
          brushId: "water",
          representativeCaseId: 0,
          groupKey: `farmrpg-${variant.season}`,
          groupLabel: variant.label,
          rules: FARMRPG_WATER_TILE_PREVIEW_RULES,
          atlas: FARMRPG_ATLAS_SOURCE,
        }),
      );

      previewItems.push(
        createTerrainToolbarPreviewItem({
          terrainSourceId: variant.terrainSourceId,
          id: `terrain.farmrpg.${variant.season}.ground.tile`,
          label: `FarmRPG ${variant.label} Ground Tile Brush`,
          materialId: "ground",
          brushId: "ground",
          representativeCaseId: 0,
          groupKey: `farmrpg-${variant.season}`,
          groupLabel: variant.label,
          rules: groundRules,
          atlas: FARMRPG_ATLAS_SOURCE,
        }),
      );
    } catch {
      // Skip variants not available in the currently generated atlas.
    }
  }

  for (const spec of FARMRPG_STATIC_TERRAIN_SOURCE_SPECS) {
    try {
      previewItems.push(
        createTerrainToolbarPreviewItem({
          terrainSourceId: spec.sourceId,
          id: spec.id,
          label: spec.label,
          materialId: "ground",
          brushId: "ground",
          representativeCaseId: spec.representativeCaseId,
          groupKey: spec.groupKey,
          groupLabel: spec.groupLabel,
          rules: resolveTransitionRulesFromRuleset(
            createFarmrpgAutotileRuleset(spec.framePrefix),
          ),
          atlas: FARMRPG_ATLAS_SOURCE,
        }),
      );
    } catch {
      // Skip static terrain variants that are not in the generated atlas yet.
    }
  }

  try {
    previewItems.unshift(
      createTerrainToolbarPreviewItem({
        id: "terrain.farmrpg.delete",
        label: "Clear Terrain",
        isSourceAgnostic: true,
        materialId: "ground",
        brushId: "delete",
        representativeCaseId: 0,
        groupKey: "farmrpg-actions",
        groupLabel: "Actions",
        rules: FARMRPG_DELETE_PREVIEW_RULES,
        atlas: FARMRPG_ATLAS_SOURCE,
      }),
    );
  } catch {
    // The generated FarmRPG atlas may not exist yet.
  }

  if (previewItems.length > 0) {
    return previewItems;
  }

  try {
    return [
      createTerrainToolbarPreviewItem({
        terrainSourceId: FARMRPG_GRASS_TERRAIN_SOURCE_ID,
        id: "terrain.farmrpg.spring.water.tile",
        label: "FarmRPG Spring Water Tile Brush",
        materialId: "water",
        brushId: "water",
        representativeCaseId: 0,
        groupKey: "farmrpg-spring",
        groupLabel: "Spring",
        rules: FARMRPG_WATER_TILE_PREVIEW_RULES,
        atlas: FARMRPG_ATLAS_SOURCE,
      }),
      createTerrainToolbarPreviewItem({
        terrainSourceId: FARMRPG_GRASS_TERRAIN_SOURCE_ID,
        id: "terrain.farmrpg.spring.ground.tile",
        label: "FarmRPG Spring Ground Tile Brush",
        materialId: "ground",
        brushId: "ground",
        representativeCaseId: 0,
        groupKey: "farmrpg-spring",
        groupLabel: "Spring",
        rules: resolveFarmrpgGroundRules("spring"),
        atlas: FARMRPG_ATLAS_SOURCE,
      }),
    ];
  } catch {
    // FarmRPG tileset atlas not yet generated — run FarmRPG asset export first.
    return [];
  }
}

export const FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS: TerrainToolbarPreviewItem[] =
  buildFarmrpgTerrainToolbarPreviewItems();

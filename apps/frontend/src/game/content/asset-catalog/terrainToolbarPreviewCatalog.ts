import terrainRulesetJson from "public-assets-json:terrain/rulesets/phase1.json";
import farmrpgTerrainRulesetJson from "public-assets-json:terrain/rulesets/farmrpg-grass.json";
import type { TerrainRulesetFile } from "../../../data";
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

export const TERRAIN_TOOLBAR_PREVIEW_ITEMS: TerrainToolbarPreviewItem[] = [
  createTerrainToolbarPreviewItem({
    id: "terrain.water.tile",
    label: "Water Tile Brush",
    materialId: "water",
    brushId: "water",
    representativeCaseId: 15,
    rules: TERRAIN_PREVIEW_RULES,
    atlas: DEBUG_ATLAS_SOURCE,
  }),
  createTerrainToolbarPreviewItem({
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
  try {
    return [
      createTerrainToolbarPreviewItem({
        id: "terrain.farmrpg.water.tile",
        label: "FarmRPG Water Tile Brush",
        materialId: "water",
        brushId: "water",
        representativeCaseId: 15,
        rules: FARMRPG_TERRAIN_PREVIEW_RULES,
        atlas: FARMRPG_ATLAS_SOURCE,
      }),
      createTerrainToolbarPreviewItem({
        id: "terrain.farmrpg.ground.tile",
        label: "FarmRPG Ground Tile Brush",
        materialId: "ground",
        brushId: "ground",
        representativeCaseId: 0,
        rules: FARMRPG_TERRAIN_PREVIEW_RULES,
        atlas: FARMRPG_ATLAS_SOURCE,
      }),
    ];
  } catch {
    // FarmRPG tileset atlas not yet generated — run slice_tileset_png.py first.
    return [];
  }
}

export const FARMRPG_TERRAIN_TOOLBAR_PREVIEW_ITEMS: TerrainToolbarPreviewItem[] =
  buildFarmrpgTerrainToolbarPreviewItems();

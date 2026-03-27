import terrainRulesetJson from "public-assets-json:terrain/rulesets/phase1.json";
import type { TerrainRulesetFile } from "../../../data";
import type { TerrainBrushId, TerrainMaterialId } from "../../terrain/contracts";
import { DEBUG_TERRAIN_ATLAS_FRAMES } from "./debugTerrainAtlas";

export type TerrainToolbarPreviewFrame = {
  frameKey: string;
  atlasFrame: { x: number; y: number; w: number; h: number };
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

function resolvePreviewFrame(rule: TerrainRulesetTransitionRule): TerrainToolbarPreviewFrame {
  const atlasEntry = DEBUG_TERRAIN_ATLAS_FRAMES[rule.frame];
  if (!atlasEntry) {
    throw new Error(`Missing debug terrain atlas frame "${rule.frame}".`);
  }

  return {
    frameKey: rule.frame,
    atlasFrame: atlasEntry.frame,
  };
}

function resolveAnimatedPreviewFrames(baseFrameKey: string): TerrainToolbarPreviewFrame[] {
  const frames: TerrainToolbarPreviewFrame[] = [];

  for (let phase = 0; phase < 256; phase += 1) {
    const frameKey = `${baseFrameKey}@${phase}`;
    const atlasEntry = DEBUG_TERRAIN_ATLAS_FRAMES[frameKey];
    if (!atlasEntry) {
      break;
    }

    frames.push({
      frameKey,
      atlasFrame: atlasEntry.frame,
    });
  }

  if (frames.length === 0) {
    const atlasEntry = DEBUG_TERRAIN_ATLAS_FRAMES[baseFrameKey];
    if (atlasEntry) {
      frames.push({
        frameKey: baseFrameKey,
        atlasFrame: atlasEntry.frame,
      });
    }
  }

  return frames;
}

function resolveTransitionRules(): TerrainRulesetTransitionRule[] {
  const terrainRuleset = terrainRulesetJson as TerrainRulesetFile;
  const transition = terrainRuleset.transitions[0];
  if (!transition) {
    throw new Error("Terrain ruleset phase1 must define at least one transition.");
  }

  return [...transition.rules].sort((left, right) => left.caseId - right.caseId);
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
}): TerrainToolbarPreviewItem {
  const representativeRule =
    input.rules.find((rule) => rule.caseId === input.representativeCaseId) ?? input.rules[0];
  if (!representativeRule) {
    throw new Error(`Terrain preview item "${input.id}" requires at least one rule.`);
  }

  const representativeFrame = resolvePreviewFrame(representativeRule);
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
    ),
  };
}

const TERRAIN_PREVIEW_RULES = resolveTransitionRules();

export const TERRAIN_TOOLBAR_PREVIEW_ITEMS: TerrainToolbarPreviewItem[] = [
  createTerrainToolbarPreviewItem({
    id: "terrain.water.tile",
    label: "Water Tile Brush",
    materialId: "water",
    brushId: "water",
    representativeCaseId: 15,
    rules: TERRAIN_PREVIEW_RULES,
  }),
  createTerrainToolbarPreviewItem({
    id: "terrain.ground.tile",
    label: "Ground Tile Brush",
    materialId: "ground",
    brushId: "ground",
    representativeCaseId: 0,
    rules: TERRAIN_PREVIEW_RULES,
  }),
];

import type { TerrainMaterialId } from "./contracts";

export type MarchingCaseRule = {
  caseId: number;
  frame: string;
  rotate90?: 0 | 1 | 2 | 3;
  flipX?: boolean;
  flipY?: boolean;
  variantGroup?: string;
};

export type TerrainTransitionRuleset = {
  id: string;
  insideMaterial: TerrainMaterialId;
  outsideMaterial: TerrainMaterialId;
  rules: MarchingCaseRule[];
};

export type TerrainRulesetFile = {
  transitions: TerrainTransitionRuleset[];
};

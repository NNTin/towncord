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
  insideMaterial: string;
  outsideMaterial: string;
  insideFillFrame?: string;
  rules: MarchingCaseRule[];
};

export type TerrainRulesetFile = {
  transitions: TerrainTransitionRuleset[];
};

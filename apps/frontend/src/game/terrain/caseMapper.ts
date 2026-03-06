import type { MarchingCaseRule } from "./ruleset";

type ResolvedCaseRule = {
  caseId: number;
  frame: string;
  rotate90: 0 | 1 | 2 | 3;
  flipX: boolean;
  flipY: boolean;
  variantGroup?: string;
};

function normalizeRule(rule: MarchingCaseRule): ResolvedCaseRule {
  const normalized: ResolvedCaseRule = {
    caseId: rule.caseId,
    frame: rule.frame,
    rotate90: rule.rotate90 ?? 0,
    flipX: rule.flipX ?? false,
    flipY: rule.flipY ?? false,
  };

  if (rule.variantGroup !== undefined) {
    normalized.variantGroup = rule.variantGroup;
  }

  return normalized;
}

export class TerrainCaseMapper {
  private readonly byCaseId = new Map<number, ResolvedCaseRule>();

  constructor(rules: MarchingCaseRule[]) {
    for (const rule of rules) {
      this.byCaseId.set(rule.caseId, normalizeRule(rule));
    }
  }

  public getRule(caseId: number): ResolvedCaseRule {
    const rule = this.byCaseId.get(caseId);
    if (!rule) {
      throw new Error(`TerrainCaseMapper: missing case mapping for caseId=${caseId}.`);
    }
    return rule;
  }
}

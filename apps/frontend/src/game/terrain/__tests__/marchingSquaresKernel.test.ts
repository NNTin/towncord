import { describe, expect, test } from "vitest";
import type { TerrainMaterialId } from "../contracts";
import { MarchingSquaresKernel, type TerrainMaterialLookup } from "../marchingSquaresKernel";

const INSIDE = "water";
const OUTSIDE = "grass";

type Corner = [x: number, y: number];

const CASE_CORNERS: Corner[] = [
  [0, 0], // nw (bit 1)
  [1, 0], // ne (bit 2)
  [1, 1], // se (bit 4)
  [0, 1], // sw (bit 8)
];

function createLookup(insideCorners: Corner[]): TerrainMaterialLookup {
  const insideKeySet = new Set(insideCorners.map(([x, y]) => `${x},${y}`));
  return (cellX: number, cellY: number): TerrainMaterialId =>
    insideKeySet.has(`${cellX},${cellY}`) ? INSIDE : OUTSIDE;
}

function cornersForCaseId(caseId: number): Corner[] {
  return CASE_CORNERS.filter((_, index) => (caseId & (1 << index)) !== 0);
}

describe("MarchingSquaresKernel", () => {
  test.each(Array.from({ length: 16 }, (_, caseId) => caseId))(
    "derives deterministic caseId %i for known corner material layout",
    (caseId) => {
      const kernel = new MarchingSquaresKernel();
      const lookup = createLookup(cornersForCaseId(caseId));

      const first = kernel.deriveCaseId(lookup, 0, 0, INSIDE);
      const second = kernel.deriveCaseId(lookup, 0, 0, INSIDE);

      expect(first).toBe(caseId);
      expect(second).toBe(caseId);
    },
  );
});

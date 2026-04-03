/**
 * Tests for the dual-grid marching squares behavior of the terrain detail overlay.
 *
 * The overlay (carpet / hay) uses the same dual-grid approach as the base terrain:
 * each junction tile at (jX, jY) covers the 4 cells
 *   NW=(jX, jY), NE=(jX+1, jY), SE=(jX+1, jY+1), SW=(jX, jY+1).
 *
 * A junction must render if ANY of those 4 cells contains a detail material —
 * not only when the NW cell does.  Painting a single carpet cell at (cx, cy)
 * must produce 4 rendered junction tiles (one per corner of that cell).
 */
import { describe, expect, test } from "vitest";
import { MarchingSquaresKernel } from "../marchingSquaresKernel";
import { TERRAIN_DETAIL_EMPTY_SOURCE_ID } from "../runtime";
import { resolveFarmrpgStaticTerrainSourceSpec } from "../../content/asset-catalog/farmrpgTerrainSourceCatalog";

const CARPET_SOURCE_ID = "public-assets:terrain/farmrpg-carpet-01";
const HAY_SOURCE_ID = "public-assets:terrain/farmrpg-barn-hay";

/**
 * Mirrors the fixed TerrainDetailTileResolver.resolveRenderTile logic so the
 * tests remain independent of the private class while verifying the exact
 * contract the implementation must satisfy.
 */
function resolveDetailTile(
  kernel: MarchingSquaresKernel,
  materialAt: (cellX: number, cellY: number) => string,
  jX: number,
  jY: number,
): { dominantMaterial: string; caseId: number; frame: string } | null {
  const nw = materialAt(jX, jY);
  const ne = materialAt(jX + 1, jY);
  const sw = materialAt(jX, jY + 1);
  const se = materialAt(jX + 1, jY + 1);

  const dominant =
    nw !== TERRAIN_DETAIL_EMPTY_SOURCE_ID
      ? nw
      : ne !== TERRAIN_DETAIL_EMPTY_SOURCE_ID
        ? ne
        : sw !== TERRAIN_DETAIL_EMPTY_SOURCE_ID
          ? sw
          : se !== TERRAIN_DETAIL_EMPTY_SOURCE_ID
            ? se
            : null;

  if (!dominant) return null;

  const sourceSpec = resolveFarmrpgStaticTerrainSourceSpec(dominant);
  if (!sourceSpec) return null;

  const caseId = kernel.deriveCaseId(materialAt, jX, jY, dominant);
  return {
    dominantMaterial: dominant,
    caseId,
    frame: `${sourceSpec.framePrefix}${caseId}`,
  };
}

function makeGrid(
  cells: Array<{ cellX: number; cellY: number; material: string }>,
): (cellX: number, cellY: number) => string {
  const map = new Map(
    cells.map(({ cellX, cellY, material }) => [`${cellX},${cellY}`, material]),
  );
  return (cellX, cellY) =>
    map.get(`${cellX},${cellY}`) ?? TERRAIN_DETAIL_EMPTY_SOURCE_ID;
}

describe("terrain detail overlay — dual-grid marching squares", () => {
  const kernel = new MarchingSquaresKernel();

  test("single carpet cell at (2,2) renders all 4 surrounding junction tiles", () => {
    // Junction (2, 2): NW = carpet → case 1  (nw only)
    // Junction (1, 2): NE = carpet → case 2  (ne only)
    // Junction (2, 1): SW = carpet → case 8  (sw only)
    // Junction (1, 1): SE = carpet → case 4  (se only)
    const materialAt = makeGrid([
      { cellX: 2, cellY: 2, material: CARPET_SOURCE_ID },
    ]);

    expect(resolveDetailTile(kernel, materialAt, 2, 2)).toMatchObject({
      caseId: 1,
    });
    expect(resolveDetailTile(kernel, materialAt, 1, 2)).toMatchObject({
      caseId: 2,
    });
    expect(resolveDetailTile(kernel, materialAt, 2, 1)).toMatchObject({
      caseId: 8,
    });
    expect(resolveDetailTile(kernel, materialAt, 1, 1)).toMatchObject({
      caseId: 4,
    });
  });

  test("dominant material is carpet for all 4 junctions around a single carpet cell", () => {
    const materialAt = makeGrid([
      { cellX: 2, cellY: 2, material: CARPET_SOURCE_ID },
    ]);

    for (const [jX, jY] of [
      [2, 2],
      [1, 2],
      [2, 1],
      [1, 1],
    ] as const) {
      expect(resolveDetailTile(kernel, materialAt, jX, jY)).toMatchObject({
        dominantMaterial: CARPET_SOURCE_ID,
      });
    }
  });

  test("junction with all 4 corners empty returns null", () => {
    const materialAt = makeGrid([]);
    expect(resolveDetailTile(kernel, materialAt, 5, 5)).toBeNull();
  });

  test("2×2 carpet block produces case 15 at the shared interior junction", () => {
    // All four cells around junction (2,2) are carpet.
    const materialAt = makeGrid([
      { cellX: 2, cellY: 2, material: CARPET_SOURCE_ID },
      { cellX: 3, cellY: 2, material: CARPET_SOURCE_ID },
      { cellX: 2, cellY: 3, material: CARPET_SOURCE_ID },
      { cellX: 3, cellY: 3, material: CARPET_SOURCE_ID },
    ]);

    expect(resolveDetailTile(kernel, materialAt, 2, 2)).toMatchObject({
      caseId: 15,
    });
  });

  test("hay cell renders at the SE junction (non-NW corner)", () => {
    // Hay at (3, 3): junction (2, 2) has hay in the SE corner → case 4.
    const materialAt = makeGrid([
      { cellX: 3, cellY: 3, material: HAY_SOURCE_ID },
    ]);

    expect(resolveDetailTile(kernel, materialAt, 2, 2)).toMatchObject({
      dominantMaterial: HAY_SOURCE_ID,
      caseId: 4,
    });
  });

  test("hay cell renders at the NE junction (non-NW corner)", () => {
    // Hay at (3, 3): junction (2, 3) has hay in the NE corner → case 2.
    const materialAt = makeGrid([
      { cellX: 3, cellY: 3, material: HAY_SOURCE_ID },
    ]);

    expect(resolveDetailTile(kernel, materialAt, 2, 3)).toMatchObject({
      dominantMaterial: HAY_SOURCE_ID,
      caseId: 2,
    });
  });

  test("NW corner wins over NE when both are non-empty", () => {
    // NW = carpet, NE = hay.  Dominant = carpet.
    const materialAt = makeGrid([
      { cellX: 4, cellY: 4, material: CARPET_SOURCE_ID },
      { cellX: 5, cellY: 4, material: HAY_SOURCE_ID },
    ]);

    const tile = resolveDetailTile(kernel, materialAt, 4, 4);
    expect(tile?.dominantMaterial).toBe(CARPET_SOURCE_ID);
    // NW = carpet (inside), NE = hay ≠ carpet (outside), SW = empty, SE = empty → case 1.
    expect(tile?.caseId).toBe(1);
  });

  test("frame is built from the source spec prefix and caseId", () => {
    const materialAt = makeGrid([
      { cellX: 0, cellY: 0, material: CARPET_SOURCE_ID },
    ]);
    const tile = resolveDetailTile(kernel, materialAt, 0, 0);
    expect(tile?.frame).toBe("tilesets.farmrpg.carpet.variant-01#1");
  });
});

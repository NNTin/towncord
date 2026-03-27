import type { TerrainSeedDocument } from "../../../data";
import type { TerrainMapStore } from "../../terrain";

export type { TerrainSeedDocument } from "../../../data";

function invertLegend(legend: TerrainSeedDocument["legend"]): Map<string, string> {
  const materialToGlyph = new Map<string, string>();
  for (const [glyph, material] of Object.entries(legend)) {
    materialToGlyph.set(material, glyph);
  }
  return materialToGlyph;
}

export function formatTerrainSeed(document: TerrainSeedDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function syncFromRuntimeTerrain(
  seed: TerrainSeedDocument,
  store: TerrainMapStore,
): TerrainSeedDocument {
  if (
    seed.width !== store.width ||
    seed.height !== store.height ||
    seed.chunkSize !== store.chunkSize ||
    seed.defaultMaterial !== store.defaultMaterial
  ) {
    throw new Error("Terrain runtime store does not match the seed template.");
  }

  const materialToGlyph = invertLegend(seed.legend);
  const rows: string[] = [];

  for (let cellY = 0; cellY < store.height; cellY += 1) {
    let row = "";

    for (let cellX = 0; cellX < store.width; cellX += 1) {
      const materialId = store.getCellMaterial(cellX, cellY);
      const glyph = materialToGlyph.get(materialId);
      if (!glyph) {
        throw new Error(`Terrain seed legend is missing material "${materialId}".`);
      }

      row += glyph;
    }

    rows.push(row);
  }

  return {
    ...seed,
    rows,
  };
}

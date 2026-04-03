import type {
  TerrainSeedDetailLayerDocument,
  TerrainSeedDocument,
} from "../../../data";
import type { TerrainMapStore } from "../../terrain";
import { TERRAIN_DETAIL_EMPTY_SOURCE_ID } from "../../terrain/runtime";

export type { TerrainSeedDocument } from "../../../data";

function invertLegend(
  legend: TerrainSeedDocument["legend"],
): Map<string, string> {
  const materialToGlyph = new Map<string, string>();
  for (const [glyph, material] of Object.entries(legend)) {
    materialToGlyph.set(material, glyph);
  }
  return materialToGlyph;
}

const DETAIL_LAYER_GLYPHS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function serializeDetailLayer(
  store: TerrainMapStore | null | undefined,
): TerrainSeedDetailLayerDocument | undefined {
  if (!store) {
    return undefined;
  }

  const usedSourceIds = new Set<string>();
  for (let cellY = 0; cellY < store.height; cellY += 1) {
    for (let cellX = 0; cellX < store.width; cellX += 1) {
      const sourceId = store.getCellMaterial(cellX, cellY);
      if (sourceId === TERRAIN_DETAIL_EMPTY_SOURCE_ID) {
        continue;
      }

      usedSourceIds.add(sourceId);
    }
  }

  if (usedSourceIds.size === 0) {
    return undefined;
  }

  const sortedSourceIds = [...usedSourceIds].sort();
  if (sortedSourceIds.length > DETAIL_LAYER_GLYPHS.length) {
    throw new Error(
      "Terrain detail layer exceeded the supported glyph budget.",
    );
  }

  const sourceIdToGlyph = new Map<string, string>();
  const legend: TerrainSeedDetailLayerDocument["legend"] = {
    ".": null,
  };

  sortedSourceIds.forEach((sourceId, index) => {
    const glyph = DETAIL_LAYER_GLYPHS[index]!;
    sourceIdToGlyph.set(sourceId, glyph);
    legend[glyph] = sourceId;
  });

  const rows: string[] = [];
  for (let cellY = 0; cellY < store.height; cellY += 1) {
    let row = "";

    for (let cellX = 0; cellX < store.width; cellX += 1) {
      const sourceId = store.getCellMaterial(cellX, cellY);
      row +=
        sourceId === TERRAIN_DETAIL_EMPTY_SOURCE_ID
          ? "."
          : (sourceIdToGlyph.get(sourceId) ?? ".");
    }

    rows.push(row);
  }

  return {
    legend,
    rows,
  };
}

export function formatTerrainSeed(document: TerrainSeedDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function syncFromRuntimeTerrain(
  seed: TerrainSeedDocument,
  store: TerrainMapStore,
  options: {
    terrainDetailsStore?: TerrainMapStore | null;
    officeDetailsStore?: TerrainMapStore | null;
  } = {},
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
        throw new Error(
          `Terrain seed legend is missing material "${materialId}".`,
        );
      }

      row += glyph;
    }

    rows.push(row);
  }

  const terrainDetails = serializeDetailLayer(options.terrainDetailsStore);
  const officeDetails = serializeDetailLayer(options.officeDetailsStore);

  const nextSeed: TerrainSeedDocument = {
    width: seed.width,
    height: seed.height,
    chunkSize: seed.chunkSize,
    defaultMaterial: seed.defaultMaterial,
    materials: [...seed.materials],
    legend: { ...seed.legend },
    rows,
  };

  if (terrainDetails) {
    nextSeed.terrainDetails = terrainDetails;
  }

  if (officeDetails) {
    nextSeed.officeDetails = officeDetails;
  }

  return nextSeed;
}

export type TerrainSeedDocument = {
  width: number;
  height: number;
  chunkSize: number;
  defaultMaterial: string;
  materials: string[];
  legend: Record<string, string>;
  rows: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function isTerrainSeedDocument(value: unknown): value is TerrainSeedDocument {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.width !== "number" ||
    typeof value.height !== "number" ||
    typeof value.chunkSize !== "number" ||
    typeof value.defaultMaterial !== "string" ||
    !isStringArray(value.materials) ||
    !isRecord(value.legend) ||
    !isStringArray(value.rows)
  ) {
    return false;
  }

  if (value.rows.length !== value.height) {
    return false;
  }

  if (!value.materials.includes(value.defaultMaterial)) {
    return false;
  }

  for (const [glyph, material] of Object.entries(value.legend)) {
    if (glyph.length !== 1 || typeof material !== "string") {
      return false;
    }

    if (!value.materials.includes(material)) {
      return false;
    }
  }

  const legendGlyphs = new Set(Object.keys(value.legend));

  for (const row of value.rows) {
    if (typeof row !== "string" || row.length !== value.width) {
      return false;
    }

    for (const glyph of row) {
      if (!legendGlyphs.has(glyph)) {
        return false;
      }
    }
  }

  return true;
}

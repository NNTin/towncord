export type TerrainSeedDetailLayerDocument = {
  legend: Record<string, string | null>;
  rows: string[];
};

export type TerrainSeedDocument = {
  width: number;
  height: number;
  chunkSize: number;
  defaultMaterial: string;
  materials: string[];
  legend: Record<string, string>;
  rows: string[];
  terrainDetails?: TerrainSeedDetailLayerDocument;
  officeDetails?: TerrainSeedDetailLayerDocument;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function isDetailLayerDocument(
  value: unknown,
  width: number,
  height: number,
): value is TerrainSeedDetailLayerDocument {
  if (
    !isRecord(value) ||
    !isRecord(value.legend) ||
    !isStringArray(value.rows)
  ) {
    return false;
  }

  if (value.rows.length !== height) {
    return false;
  }

  if (!("." in value.legend) || value.legend["."] !== null) {
    return false;
  }

  const glyphs = new Set<string>();
  for (const [glyph, sourceId] of Object.entries(value.legend)) {
    if (
      glyph.length !== 1 ||
      glyphs.has(glyph) ||
      !(typeof sourceId === "string" || sourceId === null)
    ) {
      return false;
    }

    glyphs.add(glyph);
  }

  for (const row of value.rows) {
    if (row.length !== width) {
      return false;
    }

    for (const glyph of row) {
      if (!glyphs.has(glyph)) {
        return false;
      }
    }
  }

  return true;
}

export function isTerrainSeedDocument(
  value: unknown,
): value is TerrainSeedDocument {
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

  if (
    value.terrainDetails !== undefined &&
    !isDetailLayerDocument(value.terrainDetails, value.width, value.height)
  ) {
    return false;
  }

  if (
    value.officeDetails !== undefined &&
    !isDetailLayerDocument(value.officeDetails, value.width, value.height)
  ) {
    return false;
  }

  return true;
}

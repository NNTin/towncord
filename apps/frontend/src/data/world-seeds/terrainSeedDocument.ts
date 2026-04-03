export type TerrainSeedDetailLayerDocument = {
  legend: Record<string, string | null>;
  rows: string[];
};

export type TerrainSeedPropDocument = {
  propId: string;
  cellX: number;
  cellY: number;
  rotationQuarterTurns: 0 | 1 | 2 | 3;
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
  terrainProps?: TerrainSeedPropDocument[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function isTerrainSeedPropDocument(
  value: unknown,
  width: number,
  height: number,
): value is TerrainSeedPropDocument {
  if (!isRecord(value)) {
    return false;
  }

  const { propId, cellX, cellY, rotationQuarterTurns } = value;

  return (
    typeof propId === "string" &&
    typeof cellX === "number" &&
    Number.isInteger(cellX) &&
    cellX >= 0 &&
    cellX < width &&
    typeof cellY === "number" &&
    Number.isInteger(cellY) &&
    cellY >= 0 &&
    cellY < height &&
    typeof rotationQuarterTurns === "number" &&
    Number.isInteger(rotationQuarterTurns) &&
    rotationQuarterTurns >= 0 &&
    rotationQuarterTurns <= 3
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

  const {
    width,
    height,
    chunkSize,
    defaultMaterial,
    materials,
    legend,
    rows,
    terrainDetails,
    officeDetails,
    terrainProps,
  } = value;

  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    typeof chunkSize !== "number" ||
    typeof defaultMaterial !== "string" ||
    !isStringArray(materials) ||
    !isRecord(legend) ||
    !isStringArray(rows)
  ) {
    return false;
  }

  if (rows.length !== height) {
    return false;
  }

  if (!materials.includes(defaultMaterial)) {
    return false;
  }

  for (const [glyph, material] of Object.entries(legend)) {
    if (glyph.length !== 1 || typeof material !== "string") {
      return false;
    }

    if (!materials.includes(material)) {
      return false;
    }
  }

  const legendGlyphs = new Set(Object.keys(legend));

  for (const row of rows) {
    if (typeof row !== "string" || row.length !== width) {
      return false;
    }

    for (const glyph of row) {
      if (!legendGlyphs.has(glyph)) {
        return false;
      }
    }
  }

  if (
    terrainDetails !== undefined &&
    !isDetailLayerDocument(terrainDetails, width, height)
  ) {
    return false;
  }

  if (
    officeDetails !== undefined &&
    !isDetailLayerDocument(officeDetails, width, height)
  ) {
    return false;
  }

  if (
    terrainProps !== undefined &&
    (!Array.isArray(terrainProps) ||
      !terrainProps.every((entry) =>
        isTerrainSeedPropDocument(entry, width, height),
      ))
  ) {
    return false;
  }

  return true;
}

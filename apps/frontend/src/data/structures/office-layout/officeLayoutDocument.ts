export type OfficeLayoutDocument = {
  version: number;
  cols: number;
  rows: number;
  anchor?: {
    x: number;
    y: number;
  };
  tiles: unknown[];
  tileColors?: unknown[];
  furniture?: unknown[];
  characters?: unknown[];
  [key: string]: unknown;
};

export function isOfficeLayoutDocument(value: unknown): value is OfficeLayoutDocument {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.version !== "number" ||
    typeof candidate.cols !== "number" ||
    typeof candidate.rows !== "number" ||
    !Array.isArray(candidate.tiles)
  ) {
    return false;
  }

  if (candidate.anchor !== undefined) {
    if (typeof candidate.anchor !== "object" || candidate.anchor === null) return false;
    const anchor = candidate.anchor as Record<string, unknown>;
    if (
      typeof anchor.x !== "number" ||
      !isFinite(anchor.x) ||
      typeof anchor.y !== "number" ||
      !isFinite(anchor.y)
    ) {
      return false;
    }
  }

  return true;
}

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
  return (
    typeof candidate.version === "number" &&
    typeof candidate.cols === "number" &&
    typeof candidate.rows === "number" &&
    Array.isArray(candidate.tiles)
  );
}

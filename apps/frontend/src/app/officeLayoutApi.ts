export type OfficeLayoutDocument = {
  version: number;
  cols: number;
  rows: number;
  tiles: unknown[];
  tileColors?: unknown[];
  furniture?: unknown[];
  characters?: unknown[];
  [key: string]: unknown;
};

export type OfficeLayoutApiResponse = {
  path: string;
  updatedAt: string;
  layout: OfficeLayoutDocument;
};

const OFFICE_LAYOUT_ROUTE = "/__office-layout";

function isOfficeLayoutDocument(value: unknown): value is OfficeLayoutDocument {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.version === "number" &&
    typeof candidate.cols === "number" &&
    typeof candidate.rows === "number" &&
    Array.isArray(candidate.tiles)
  );
}

async function readJsonResponse(response: Response): Promise<OfficeLayoutApiResponse> {
  const payload = (await response.json()) as unknown;
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Office layout API returned an invalid payload.");
  }

  const candidate = payload as Partial<OfficeLayoutApiResponse> & { error?: unknown };
  if (!response.ok) {
    throw new Error(
      typeof candidate.error === "string"
        ? candidate.error
        : `Office layout request failed with ${response.status}.`,
    );
  }

  if (
    typeof candidate.path !== "string" ||
    typeof candidate.updatedAt !== "string" ||
    !isOfficeLayoutDocument(candidate.layout)
  ) {
    throw new Error("Office layout API response shape was invalid.");
  }

  return {
    path: candidate.path,
    updatedAt: candidate.updatedAt,
    layout: candidate.layout,
  };
}

export async function loadOfficeLayout(): Promise<OfficeLayoutApiResponse> {
  const response = await fetch(OFFICE_LAYOUT_ROUTE, {
    headers: { Accept: "application/json" },
  });

  return readJsonResponse(response);
}

export async function saveOfficeLayout(
  layout: OfficeLayoutDocument,
): Promise<OfficeLayoutApiResponse> {
  const response = await fetch(OFFICE_LAYOUT_ROUTE, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(layout),
  });

  return readJsonResponse(response);
}

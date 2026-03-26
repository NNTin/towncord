import {
  isOfficeLayoutDocument,
  type OfficeLayoutDocument,
} from "../../../data";

export type { OfficeLayoutDocument } from "../../../data";

export type ParsedOfficeLayout = {
  document: OfficeLayoutDocument | null;
  error: string | null;
};

export function parseOfficeLayout(text: string): ParsedOfficeLayout {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return {
        document: null,
        error: "The office layout JSON must contain an object.",
      };
    }

    if (!isOfficeLayoutDocument(parsed)) {
      return {
        document: null,
        error: "The office layout JSON is missing required top-level fields.",
      };
    }

    return {
      document: parsed,
      error: null,
    };
  } catch (error) {
    return {
      document: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to parse office layout JSON.",
    };
  }
}

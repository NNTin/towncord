import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadOfficeLayout,
  saveOfficeLayout,
  type OfficeLayoutApiResponse,
  type OfficeLayoutDocument,
} from "./officeLayoutApi";

type ParsedState = {
  document: OfficeLayoutDocument | null;
  error: string | null;
};

export type OfficeLayoutEditorState = {
  isOpen: boolean;
  toggleOpen: () => void;
  jsonText: string;
  onChangeJsonText: (next: string) => void;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isAvailable: boolean;
  canSave: boolean;
  canReset: boolean;
  error: string | null;
  parseError: string | null;
  statusText: string;
  sourcePath: string | null;
  updatedAt: string | null;
  parsedDocument: OfficeLayoutDocument | null;
  reload: () => Promise<void>;
  reset: () => void;
  save: () => Promise<void>;
};

function formatOfficeLayout(layout: OfficeLayoutDocument): string {
  return `${JSON.stringify(layout, null, 2)}\n`;
}

function parseOfficeLayout(text: string): ParsedState {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return {
        document: null,
        error: "The office layout JSON must contain an object.",
      };
    }

    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.version !== "number" ||
      typeof candidate.cols !== "number" ||
      typeof candidate.rows !== "number" ||
      !Array.isArray(candidate.tiles)
    ) {
      return {
        document: null,
        error: "The office layout JSON is missing required top-level fields.",
      };
    }

    return {
      document: candidate as OfficeLayoutDocument,
      error: null,
    };
  } catch (error) {
    return {
      document: null,
      error: error instanceof Error ? error.message : "Failed to parse office layout JSON.",
    };
  }
}

function toStatusText(args: {
  isAvailable: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  error: string | null;
  parseError: string | null;
}): string {
  if (!args.isAvailable) return "Read-only";
  if (args.isSaving) return "Saving";
  if (args.isLoading) return "Loading";
  if (args.error) return "Sync Error";
  if (args.parseError) return "JSON Error";
  if (args.isDirty) return "Unsaved";
  return "Synced";
}

export function useOfficeLayoutEditor(): OfficeLayoutEditorState {
  const [isOpen, setIsOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const isAvailable = import.meta.env.DEV;
  const isDirty = jsonText !== savedText;
  const parsed = useMemo(() => parseOfficeLayout(jsonText), [jsonText]);

  const applyResponse = useCallback((payload: OfficeLayoutApiResponse): void => {
    const nextText = formatOfficeLayout(payload.layout);
    setJsonText(nextText);
    setSavedText(nextText);
    setSourcePath(payload.path);
    setUpdatedAt(payload.updatedAt);
    setError(null);
  }, []);

  const reload = useCallback(async () => {
    if (!isAvailable) {
      setError("Canonical office layout sync is only available in Vite dev mode.");
      return;
    }

    setIsLoading(true);
    try {
      applyResponse(await loadOfficeLayout());
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to load the canonical office layout.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyResponse, isAvailable]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const reset = useCallback(() => {
    setJsonText(savedText);
    setError(null);
  }, [savedText]);

  const save = useCallback(async () => {
    if (!isAvailable || !parsed.document) return;

    setIsSaving(true);
    try {
      applyResponse(await saveOfficeLayout(parsed.document));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to save the canonical office layout.",
      );
    } finally {
      setIsSaving(false);
    }
  }, [applyResponse, isAvailable, parsed.document]);

  return {
    isOpen,
    toggleOpen: () => setIsOpen((current) => !current),
    jsonText,
    onChangeJsonText: setJsonText,
    isDirty,
    isLoading,
    isSaving,
    isAvailable,
    canSave: isAvailable && !isLoading && !isSaving && isDirty && !parsed.error,
    canReset: isDirty,
    error,
    parseError: parsed.error,
    statusText: toStatusText({
      isAvailable,
      isLoading,
      isSaving,
      isDirty,
      error,
      parseError: parsed.error,
    }),
    sourcePath,
    updatedAt,
    parsedDocument: parsed.document,
    reload,
    reset,
    save,
  };
}

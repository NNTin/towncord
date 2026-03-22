import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type OfficeLayoutDocument,
  officeLayoutPersistence,
} from "./officeLayoutApi";
import type {
  OfficeLayoutPersistenceAdapter,
  OfficeLayoutPersistenceSnapshot,
} from "./officeLayoutContracts";
import type { OfficeSceneLayout } from "./officeLayoutSceneContract";

type ParsedState = {
  document: OfficeLayoutDocument | null;
  error: string | null;
};

type OfficeLayoutEditorState = {
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
  syncFromPhaser: (layout: OfficeSceneLayout) => void;
};

type UseOfficeLayoutEditorOptions = {
  persistence?: OfficeLayoutPersistenceAdapter;
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

export function useOfficeLayoutEditor(
  options: UseOfficeLayoutEditorOptions = {},
): OfficeLayoutEditorState {
  const persistence = options.persistence ?? officeLayoutPersistence;
  const [isOpen, setIsOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const isAvailable = persistence.isAvailable;
  const isDirty = jsonText !== savedText;
  const parsed = useMemo(() => parseOfficeLayout(jsonText), [jsonText]);

  const applySnapshot = useCallback((snapshot: OfficeLayoutPersistenceSnapshot): void => {
    const nextText = formatOfficeLayout(snapshot.document);
    setJsonText(nextText);
    setSavedText(nextText);
    setSourcePath(snapshot.sourcePath);
    setUpdatedAt(snapshot.updatedAt);
    setError(null);
  }, []);

  const reload = useCallback(async () => {
    if (!isAvailable) {
      setError(
        persistence.unavailableReason ?? "Office layout persistence is not available.",
      );
      return;
    }

    setIsLoading(true);
    try {
      applySnapshot(await persistence.load());
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to load the canonical office layout.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [applySnapshot, isAvailable, persistence]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const reset = useCallback(() => {
    setJsonText(savedText);
    setError(null);
  }, [savedText]);

  const syncFromPhaser = useCallback((layout: OfficeSceneLayout): void => {
    const doc: OfficeLayoutDocument = {
      version: 2,
      cols: layout.cols,
      rows: layout.rows,
      cellSize: layout.cellSize,
      tiles: layout.tiles,
      furniture: layout.furniture,
      characters: layout.characters,
    };
    setJsonText(formatOfficeLayout(doc));
  }, []);

  const save = useCallback(async () => {
    if (!isAvailable || !parsed.document) return;

    setIsSaving(true);
    try {
      applySnapshot(await persistence.save(parsed.document));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to save the canonical office layout.",
      );
    } finally {
      setIsSaving(false);
    }
  }, [applySnapshot, isAvailable, parsed.document, persistence]);

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
    syncFromPhaser,
  };
}

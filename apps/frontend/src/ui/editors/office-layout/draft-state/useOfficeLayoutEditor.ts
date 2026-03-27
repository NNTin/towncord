import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createOfficeLayoutEditorService,
  formatOfficeLayout,
  type OfficeLayoutDocument,
  type OfficeLayoutPersistenceAdapter,
  parseOfficeLayout,
  syncFromRuntimeLayout,
  toOfficeEditorStatusText,
} from "../../../../game";
import type { OfficeSceneLayout } from "../../../../game/contracts/office-scene";

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
  syncFromRuntime: (layout: OfficeSceneLayout) => void;
};

type UseOfficeLayoutEditorOptions = {
  persistence?: OfficeLayoutPersistenceAdapter;
};

export function useOfficeLayoutEditor(
  options: UseOfficeLayoutEditorOptions = {},
): OfficeLayoutEditorState {
  const service = useMemo(
    () => createOfficeLayoutEditorService(options.persistence),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.persistence],
  );
  const [isOpen, setIsOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const isAvailable = service.isAvailable;
  const isDirty = jsonText !== savedText;
  const parsed = useMemo(() => parseOfficeLayout(jsonText), [jsonText]);

  const applySnapshot = useCallback(
    (snapshot: {
      document: OfficeLayoutDocument;
      sourcePath: string;
      updatedAt: string;
    }): void => {
      const nextText = formatOfficeLayout(snapshot.document);
      setJsonText(nextText);
      setSavedText(nextText);
      setSourcePath(snapshot.sourcePath);
      setUpdatedAt(snapshot.updatedAt);
      setError(null);
    },
    [],
  );

  const reload = useCallback(async () => {
    if (!isAvailable) {
      setError(
        service.unavailableReason ??
          "Office layout persistence is not available.",
      );
      return;
    }

    setIsLoading(true);
    try {
      applySnapshot(await service.load());
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to load the canonical office layout.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [applySnapshot, isAvailable, service]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const reset = useCallback(() => {
    setJsonText(savedText);
    setError(null);
  }, [savedText]);

  const syncFromRuntime = useCallback((layout: OfficeSceneLayout): void => {
    setJsonText(formatOfficeLayout(syncFromRuntimeLayout(layout)));
  }, []);

  const save = useCallback(async () => {
    if (!isAvailable || !parsed.document) return;

    setIsSaving(true);
    try {
      applySnapshot(await service.save(parsed.document));
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : "Failed to save the canonical office layout.";
      setError(message);
      throw nextError instanceof Error ? nextError : new Error(message);
    } finally {
      setIsSaving(false);
    }
  }, [applySnapshot, isAvailable, parsed.document, service]);

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
    statusText: toOfficeEditorStatusText({
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
    syncFromRuntime,
  };
}

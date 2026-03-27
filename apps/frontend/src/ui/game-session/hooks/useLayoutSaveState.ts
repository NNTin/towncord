import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createTerrainSeedEditorService,
  formatTerrainSeed,
  type TerrainSeedDocument,
} from "../../../game";
import type { OfficeLayoutEditorState } from "../../editors/office-layout/draft-state/useOfficeLayoutEditor";

type UseLayoutSaveStateOptions = {
  officeEditor: Pick<
    OfficeLayoutEditorState,
    | "isAvailable"
    | "isLoading"
    | "isSaving"
    | "isDirty"
    | "canReset"
    | "error"
    | "parseError"
    | "save"
    | "reset"
  >;
  terrainSeedSnapshot: TerrainSeedDocument | null;
};

export type LayoutSaveState = {
  canSave: boolean;
  canReset: boolean;
  error: string | null;
  isAvailable: boolean;
  isDirty: boolean;
  isSaving: boolean;
  reset: () => void;
  save: () => Promise<void>;
  statusText: string;
};

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useLayoutSaveState({
  officeEditor,
  terrainSeedSnapshot,
}: UseLayoutSaveStateOptions): LayoutSaveState {
  const terrainService = useMemo(() => createTerrainSeedEditorService(), []);
  const [savedTerrainSeedText, setSavedTerrainSeedText] = useState<string | null>(
    null,
  );
  const [terrainLoadError, setTerrainLoadError] = useState<string | null>(null);
  const [terrainSaveError, setTerrainSaveError] = useState<string | null>(null);
  const [isTerrainLoading, setIsTerrainLoading] = useState(false);
  const [isTerrainSaving, setIsTerrainSaving] = useState(false);

  const terrainSeedText = useMemo(
    () => (terrainSeedSnapshot ? formatTerrainSeed(terrainSeedSnapshot) : null),
    [terrainSeedSnapshot],
  );
  const isTerrainDirty =
    savedTerrainSeedText != null &&
    terrainSeedText != null &&
    terrainSeedText !== savedTerrainSeedText;
  const terrainIsReady = savedTerrainSeedText != null && terrainSeedText != null;
  const isAvailable = officeEditor.isAvailable && terrainService.isAvailable;
  const isDirty = officeEditor.isDirty || isTerrainDirty;
  const isSaving = officeEditor.isSaving || isTerrainSaving;

  useEffect(() => {
    let isActive = true;

    if (!terrainService.isAvailable) {
      setTerrainLoadError(
        terrainService.unavailableReason ??
          "Terrain seed persistence is not available.",
      );
      setIsTerrainLoading(false);
      return () => {
        isActive = false;
      };
    }

    setIsTerrainLoading(true);
    setTerrainLoadError(null);

    void terrainService
      .load()
      .then((snapshot) => {
        if (!isActive) {
          return;
        }

        setSavedTerrainSeedText(formatTerrainSeed(snapshot.document));
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setTerrainLoadError(
          toErrorMessage(
            error,
            "Failed to load the canonical terrain seed.",
          ),
        );
      })
      .finally(() => {
        if (!isActive) {
          return;
        }

        setIsTerrainLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [terrainService]);

  const save = useCallback(async () => {
    if (!isAvailable || !terrainIsReady || !terrainSeedSnapshot) {
      return;
    }
    if (officeEditor.parseError) {
      return;
    }

    setTerrainSaveError(null);

    try {
      await officeEditor.save();
    } catch {
      return;
    }

    setIsTerrainSaving(true);
    try {
      const snapshot = await terrainService.save(terrainSeedSnapshot);
      setSavedTerrainSeedText(formatTerrainSeed(snapshot.document));
    } catch (error) {
      setTerrainSaveError(
        toErrorMessage(error, "Failed to save the terrain seed."),
      );
    } finally {
      setIsTerrainSaving(false);
    }
  }, [
    isAvailable,
    officeEditor,
    terrainIsReady,
    terrainSeedSnapshot,
    terrainService,
  ]);

  const error =
    officeEditor.error ?? terrainSaveError ?? terrainLoadError ?? null;

  return {
    canSave:
      isAvailable &&
      !isSaving &&
      !isTerrainLoading &&
      officeEditor.parseError == null &&
      terrainIsReady &&
      isDirty,
    canReset: officeEditor.canReset,
    error,
    isAvailable,
    isDirty,
    isSaving,
    reset: officeEditor.reset,
    save,
    statusText: !isAvailable
      ? "Read-only"
      : isSaving
        ? "Saving"
        : isTerrainLoading || officeEditor.isLoading || terrainSeedText == null
          ? "Loading"
          : officeEditor.parseError
            ? "JSON Error"
            : error
              ? "Sync Error"
              : isDirty
                ? "Unsaved"
                : "Synced",
  };
}

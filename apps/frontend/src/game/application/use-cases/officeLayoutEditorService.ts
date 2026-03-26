import {
  createOfficeLayoutPersistenceAdapter,
  type OfficeLayoutDocument,
  type OfficeLayoutPersistenceAdapter,
  type OfficeLayoutPersistenceSnapshot,
} from "../../../data";
import { frontendConfig } from "../../../config";
import { frontendTelemetry } from "../../../telemetry";

export type {
  OfficeLayoutDocument,
  OfficeLayoutPersistenceAdapter,
  OfficeLayoutPersistenceSnapshot,
} from "../../../data";

const officeLayoutPersistence = createOfficeLayoutPersistenceAdapter({
  mode: frontendConfig.officeLayout.persistenceMode,
  onEvent: (event) => frontendTelemetry.track(event),
});

export function toOfficeEditorStatusText(args: {
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

export type OfficeLayoutEditorService = {
  isAvailable: boolean;
  unavailableReason: string | null;
  load: () => Promise<OfficeLayoutPersistenceSnapshot>;
  save: (
    document: OfficeLayoutDocument,
  ) => Promise<OfficeLayoutPersistenceSnapshot>;
};

export function createOfficeLayoutEditorService(
  persistence: OfficeLayoutPersistenceAdapter = officeLayoutPersistence,
): OfficeLayoutEditorService {
  return {
    get isAvailable() {
      return persistence.isAvailable;
    },
    get unavailableReason() {
      return persistence.unavailableReason;
    },
    load: () => persistence.load(),
    save: (document) => persistence.save(document),
  };
}

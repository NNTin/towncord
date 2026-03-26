import type { OfficeLayoutDocument } from "./officeLayoutDocument";

export const OFFICE_LAYOUT_DEV_ROUTE = "/__office-layout";

export type OfficeLayoutPersistenceMode = "development" | "disabled";

export type OfficeLayoutPersistenceEvent = {
  name: string;
  attributes?: Record<string, unknown>;
};

export type OfficeLayoutPersistenceEventSink = (
  event: OfficeLayoutPersistenceEvent,
) => void;

export type OfficeLayoutPersistenceSnapshot = {
  document: OfficeLayoutDocument;
  sourcePath: string;
  updatedAt: string;
};

export interface OfficeLayoutPersistenceAdapter {
  readonly id: string;
  readonly isAvailable: boolean;
  readonly unavailableReason: string | null;
  load(): Promise<OfficeLayoutPersistenceSnapshot>;
  save(document: OfficeLayoutDocument): Promise<OfficeLayoutPersistenceSnapshot>;
}

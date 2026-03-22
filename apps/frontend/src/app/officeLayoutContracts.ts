import type { ContentPersistenceAdapter, PersistedContentSnapshot } from "./contentInterfaces";
import type { OfficeLayoutDocument } from "./officeLayoutDocument";

export const OFFICE_LAYOUT_DEV_ROUTE = "/__office-layout";

export type OfficeLayoutPersistenceSnapshot = PersistedContentSnapshot<OfficeLayoutDocument>;

export interface OfficeLayoutPersistenceAdapter
  extends ContentPersistenceAdapter<OfficeLayoutDocument> {}

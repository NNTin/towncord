export type RepositoryAvailability = {
  readonly id: string;
  readonly isAvailable: boolean;
  readonly unavailableReason: string | null;
};

export interface ReadonlyDocumentRepository<TDocument>
  extends RepositoryAvailability {
  read(): Promise<TDocument>;
}

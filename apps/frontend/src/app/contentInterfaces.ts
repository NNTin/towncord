export interface ContentRepository<TContent> {
  read(): TContent;
}

export type PersistedContentSnapshot<TDocument> = {
  document: TDocument;
  sourcePath: string;
  updatedAt: string;
};

export interface ContentPersistenceAdapter<TDocument> {
  readonly id: string;
  readonly isAvailable: boolean;
  readonly unavailableReason: string | null;
  load(): Promise<PersistedContentSnapshot<TDocument>>;
  save(document: TDocument): Promise<PersistedContentSnapshot<TDocument>>;
}

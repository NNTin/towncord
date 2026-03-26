export interface ContentRepository<TContent> {
  read(): TContent;
}

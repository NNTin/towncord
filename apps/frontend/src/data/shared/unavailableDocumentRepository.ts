import type { ReadonlyDocumentRepository } from "../contracts";

export function createUnavailableReadonlyDocumentRepository<TDocument>(options: {
  id: string;
  reason: string;
}): ReadonlyDocumentRepository<TDocument> {
  const fail = async (): Promise<TDocument> => {
    throw new Error(options.reason);
  };

  return {
    id: options.id,
    isAvailable: false,
    unavailableReason: options.reason,
    read: fail,
  };
}

export type RuntimeEventHost = {
  events: {
    emit: (event: string, payload?: unknown) => void;
    on: (
      event: string,
      fn: (payload: unknown) => void,
      context?: unknown,
    ) => void;
    off: (
      event: string,
      fn: (payload: unknown) => void,
      context?: unknown,
    ) => void;
  };
};

export type RuntimeHost = RuntimeEventHost & {
  destroy: (removeCanvas: boolean, noReturn?: boolean) => void;
  getUiBootstrapSnapshot?: () => unknown;
  registry?: {
    get: (key: string) => unknown;
  };
};

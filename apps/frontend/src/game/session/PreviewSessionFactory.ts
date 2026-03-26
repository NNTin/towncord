import {
  createPreviewRuntimeHostAssembly,
  type PreviewRuntimeHostAssemblyFactory,
} from "../runtime/assembly/createPreviewRuntimeHostAssembly";
import type { PreviewSession } from "./PreviewSession";
import { createMountedPreviewSession } from "./preview/createMountedPreviewSession";

export type PreviewSessionFactory = {
  mount: (container: HTMLElement) => PreviewSession;
};

export type MountedPreviewSessionFactory = typeof createMountedPreviewSession;

export function createPreviewSessionFactory(
  options: {
    createRuntime?: PreviewRuntimeHostAssemblyFactory;
    createSession?: MountedPreviewSessionFactory;
  } = {},
): PreviewSessionFactory {
  const createRuntime =
    options.createRuntime ?? createPreviewRuntimeHostAssembly;
  const createSession = options.createSession ?? createMountedPreviewSession;

  return {
    mount(container) {
      const runtime = createRuntime(container);
      return createSession(runtime);
    },
  };
}

export const previewSessionFactory = createPreviewSessionFactory();

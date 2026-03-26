import { createPreviewRuntimeHost } from "../../../engine/runtime-host";
import { createPreviewRuntimeScene } from "../../../engine/preview-runtime/scene/runtimeScenes";
import { createPreviewSceneLifecycle } from "../preview/createPreviewSceneLifecycle";
import type { RuntimeHost } from "../transport/host";

export type PreviewRuntimeHostAssemblyFactory = (
  parent: HTMLElement,
) => RuntimeHost;

export function createPreviewRuntimeHostAssembly(
  parent: HTMLElement,
): RuntimeHost {
  const adapter = createPreviewSceneLifecycle();
  return createPreviewRuntimeHost(parent, [createPreviewRuntimeScene(adapter)]);
}

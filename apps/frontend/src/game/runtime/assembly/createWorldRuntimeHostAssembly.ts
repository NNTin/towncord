import { createWorldRuntimeHost } from "../../../engine/runtime-host";
import {
  createBootRuntimeScene,
  createPreloadRuntimeScene,
  createWorldRuntimeScene,
} from "../../../engine/world-runtime/scene/runtimeScenes";
import { createWorldRuntimePreloadLifecycle } from "../preload/createWorldRuntimePreloadLifecycle";
import type { RuntimeHost } from "../transport/host";
import { createWorldSceneLifecycle } from "../world/createWorldSceneLifecycle";

export type WorldRuntimeHostAssemblyFactory = (
  parent: HTMLElement,
) => RuntimeHost;

export function createWorldRuntimeHostAssembly(
  parent: HTMLElement,
): RuntimeHost {
  const preloadAdapter = createWorldRuntimePreloadLifecycle();
  const lifecycleAdapter = createWorldSceneLifecycle();

  return createWorldRuntimeHost(parent, [
    createBootRuntimeScene(),
    createPreloadRuntimeScene(preloadAdapter),
    createWorldRuntimeScene(lifecycleAdapter),
  ]);
}

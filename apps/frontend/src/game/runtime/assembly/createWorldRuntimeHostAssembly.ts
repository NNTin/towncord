import { createWorldRuntimeHost } from "../../../engine/runtime-host";
import {
  createBootRuntimeScene,
  createPreloadRuntimeScene,
  createWorldRuntimeScene,
} from "../../../engine/world-runtime/scene/runtimeScenes";
import type { RuntimeBootstrapPayload } from "../../contracts/runtime";
import { createWorldRuntimePreloadLifecycle } from "../preload/createWorldRuntimePreloadLifecycle";
import type { RuntimeHost } from "../transport/host";
import { createWorldSceneLifecycle } from "../world/createWorldSceneLifecycle";

export type WorldRuntimeHostAssemblyFactory = (
  parent: HTMLElement,
) => RuntimeHost;

export function createWorldRuntimeHostAssembly(
  parent: HTMLElement,
): RuntimeHost {
  let uiBootstrapSnapshot: RuntimeBootstrapPayload | null = null;
  const preloadAdapter = createWorldRuntimePreloadLifecycle({
    onUiBootstrap(bootstrap) {
      uiBootstrapSnapshot = bootstrap;
    },
  });
  const lifecycleAdapter = createWorldSceneLifecycle();

  const runtime = createWorldRuntimeHost(parent, [
    createBootRuntimeScene(),
    createPreloadRuntimeScene(preloadAdapter),
    createWorldRuntimeScene(lifecycleAdapter),
  ]);

  runtime.getUiBootstrapSnapshot = () => uiBootstrapSnapshot;
  return runtime;
}

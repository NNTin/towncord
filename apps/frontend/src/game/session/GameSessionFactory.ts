import {
  createWorldRuntimeHostAssembly,
  type WorldRuntimeHostAssemblyFactory,
} from "../runtime/assembly/createWorldRuntimeHostAssembly";
import type { GameSession } from "./GameSession";
import { createMountedGameSession } from "./runtime/createMountedGameSession";

export type GameSessionFactory = {
  mount: (container: HTMLElement) => GameSession;
};

export type MountedGameSessionFactory = typeof createMountedGameSession;

export function createGameSessionFactory(
  options: {
    createRuntime?: WorldRuntimeHostAssemblyFactory;
    createSession?: MountedGameSessionFactory;
  } = {},
): GameSessionFactory {
  const createRuntime =
    options.createRuntime ?? createWorldRuntimeHostAssembly;
  const createSession = options.createSession ?? createMountedGameSession;

  return {
    mount(container) {
      const runtime = createRuntime(container);
      return createSession(runtime);
    },
  };
}

export const gameSessionFactory = createGameSessionFactory();

import {
  collectPhaseDurationsByAnimationId,
  readOptionalAnimationManifest,
} from "../content/preload/animation";
import {
  DEBUG_ANIMATIONS_JSON_KEY,
  FARMRPG_ANIMATIONS_JSON_KEY,
} from "../content/preload/preload";
import {
  loadTerrainBootstrap,
  validateTerrainBootstrap,
} from "../application/runtime-compilation/terrain-surfaces/terrainBootstrap";
import { TerrainCaseMapper } from "./caseMapper";
import { TerrainChunkBuilder } from "./chunkBuilder";
import { TerrainCommands } from "./commands";
import { TerrainEditRouter } from "./editRouter";
import {
  DEFAULT_TERRAIN_MATERIAL_RULES,
  TerrainGameplayGrid,
} from "./gameplayGrid";
import { MarchingSquaresKernel } from "./marchingSquaresKernel";
import { TerrainQueries } from "./queries";
import type { TerrainRenderSurface } from "./renderSurface";
import { TerrainMapStore } from "./store";
import { TerrainTileResolver } from "./tileResolver";
import { TerrainVisibleChunkResolver } from "./visibleChunkResolver";
import {
  TerrainRuntime,
  type TerrainRuntimeOptions,
} from "../../engine/terrain";
import type { TerrainSeedDocument } from "../../data";
import {
  readTerrainContent,
  type TerrainContent,
  type TerrainContentSourceId,
} from "../content/asset-catalog/terrainContentRepository";

type TerrainRuntimeSharedState = {
  store: TerrainMapStore;
  gameplayGrid: TerrainGameplayGrid;
};

export type TerrainRuntimeContext = {
  sourceId: TerrainContentSourceId;
  seedDocument: TerrainSeedDocument;
  gameplayGrid: TerrainGameplayGrid;
  runtimeOptions: Omit<TerrainRuntimeOptions, "store"> & {
    store: TerrainMapStore;
  };
};

type CreateTerrainRuntimeContextOptions = {
  terrainContent?: TerrainContent;
  sharedState?: TerrainRuntimeSharedState;
};

const ANIMATION_MANIFEST_KEY_BY_TERRAIN_TEXTURE: Record<string, string> = {
  "debug.tilesets": DEBUG_ANIMATIONS_JSON_KEY,
  "farmrpg.tilesets": FARMRPG_ANIMATIONS_JSON_KEY,
};

function resolveTerrainAnimationManifestKey(textureKey: string): string {
  return (
    ANIMATION_MANIFEST_KEY_BY_TERRAIN_TEXTURE[textureKey] ??
    DEBUG_ANIMATIONS_JSON_KEY
  );
}

export function createTerrainRuntimeContext(
  scene: TerrainRenderSurface,
  options: CreateTerrainRuntimeContextOptions = {},
): TerrainRuntimeContext {
  const terrainContent = options.terrainContent ?? readTerrainContent();
  const bootstrap = loadTerrainBootstrap(
    terrainContent.seed,
    terrainContent.ruleset,
  );
  validateTerrainBootstrap(scene, bootstrap, terrainContent.textureKey);
  const animationManifest = readOptionalAnimationManifest(
    scene as unknown as Record<string, unknown>,
    resolveTerrainAnimationManifestKey(terrainContent.textureKey),
  );
  const phaseDurationsByAnimationId =
    collectPhaseDurationsByAnimationId(animationManifest);

  const store =
    options.sharedState?.store ?? new TerrainMapStore(bootstrap.gridSpec);
  const gameplayGrid =
    options.sharedState?.gameplayGrid ??
    new TerrainGameplayGrid(store, DEFAULT_TERRAIN_MATERIAL_RULES);

  if (
    store.width !== bootstrap.gridSpec.width ||
    store.height !== bootstrap.gridSpec.height ||
    store.chunkSize !== bootstrap.gridSpec.chunkSize ||
    store.defaultMaterial !== bootstrap.gridSpec.defaultMaterial
  ) {
    throw new Error(
      "Terrain runtime shared state does not match the selected terrain content.",
    );
  }

  const kernel = new MarchingSquaresKernel();
  const mapper = new TerrainCaseMapper(bootstrap.transition.rules);
  const tileResolver = new TerrainTileResolver(
    kernel,
    mapper,
    bootstrap.transition.insideMaterial,
    bootstrap.transition.insideFillFrame,
  );
  const chunkBuilder = new TerrainChunkBuilder(store, tileResolver);
  const commands = new TerrainCommands(
    new TerrainEditRouter(),
    store,
    gameplayGrid,
  );
  const queries = new TerrainQueries(
    store,
    gameplayGrid,
    tileResolver,
    terrainContent.textureKey,
  );
  const visibleChunks = new TerrainVisibleChunkResolver(
    store.chunkSize,
    store.chunkCountX,
    store.chunkCountY,
  );

  return {
    sourceId: terrainContent.sourceId,
    seedDocument: terrainContent.seed,
    gameplayGrid,
    runtimeOptions: {
      gridSpec: bootstrap.gridSpec,
      store,
      chunkBuilder,
      commands,
      queries,
      visibleChunks,
      textureKey: terrainContent.textureKey,
      animationPhaseDurationsById: phaseDurationsByAnimationId,
    },
  };
}

export function createTerrainRuntimeOptions(
  scene: TerrainRenderSurface,
): TerrainRuntimeOptions {
  return createTerrainRuntimeContext(scene).runtimeOptions;
}

export function createTerrainRuntime(
  scene: TerrainRenderSurface,
): TerrainRuntime {
  return new TerrainRuntime(scene, createTerrainRuntimeOptions(scene));
}

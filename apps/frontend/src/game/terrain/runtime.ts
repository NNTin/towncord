import {
  collectPhaseDurationsByAnimationId,
  readOptionalAnimationManifest,
} from "../content/preload/animation";
import { DEBUG_ANIMATIONS_JSON_KEY } from "../content/preload/preload";
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
import { TERRAIN_TEXTURE_KEY } from "./contracts";
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

export function createTerrainRuntimeOptions(
  scene: TerrainRenderSurface,
): TerrainRuntimeOptions {
  const bootstrap = loadTerrainBootstrap();
  validateTerrainBootstrap(scene, bootstrap);
  const debugAnimationManifest = readOptionalAnimationManifest(
    scene as unknown as Record<string, unknown>,
    DEBUG_ANIMATIONS_JSON_KEY,
  );
  const phaseDurationsByAnimationId = collectPhaseDurationsByAnimationId(
    debugAnimationManifest,
  );

  const store = new TerrainMapStore(bootstrap.gridSpec);
  const kernel = new MarchingSquaresKernel();
  const mapper = new TerrainCaseMapper(bootstrap.transition.rules);
  const tileResolver = new TerrainTileResolver(
    kernel,
    mapper,
    bootstrap.transition.insideMaterial,
  );
  const chunkBuilder = new TerrainChunkBuilder(store, tileResolver);
  const gameplayGrid = new TerrainGameplayGrid(
    store,
    DEFAULT_TERRAIN_MATERIAL_RULES,
  );
  const commands = new TerrainCommands(
    new TerrainEditRouter(),
    store,
    gameplayGrid,
  );
  const queries = new TerrainQueries(store, gameplayGrid, tileResolver);
  const visibleChunks = new TerrainVisibleChunkResolver(
    store.chunkSize,
    store.chunkCountX,
    store.chunkCountY,
  );

  return {
    gridSpec: bootstrap.gridSpec,
    store,
    chunkBuilder,
    commands,
    queries,
    visibleChunks,
    textureKey: TERRAIN_TEXTURE_KEY,
    animationPhaseDurationsById: phaseDurationsByAnimationId,
  };
}

export function createTerrainRuntime(
  scene: TerrainRenderSurface,
): TerrainRuntime {
  return new TerrainRuntime(scene, createTerrainRuntimeOptions(scene));
}

import type Phaser from "phaser";
import {
  collectPhaseDurationsByAnimationId,
  readOptionalAnimationManifest,
} from "../assets/animation";
import { DEBUG_ANIMATIONS_JSON_KEY } from "../assets/preload";
import { loadTerrainBootstrap, validateTerrainBootstrap } from "./bootstrap";
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
import { TerrainRenderer } from "./renderer";
import { TerrainMapStore } from "./store";
import { TerrainTileResolver } from "./tileResolver";
import { TerrainVisibleChunkResolver } from "./visibleChunkResolver";

export type TerrainRuntime = {
  store: TerrainMapStore;
  chunkBuilder: TerrainChunkBuilder;
  renderer: TerrainRenderer;
  commands: TerrainCommands;
  queries: TerrainQueries;
  visibleChunks: TerrainVisibleChunkResolver;
};

export function createTerrainRuntime(scene: Phaser.Scene): TerrainRuntime {
  const bootstrap = loadTerrainBootstrap();
  validateTerrainBootstrap(scene, bootstrap);
  const debugAnimationManifest = readOptionalAnimationManifest(scene, DEBUG_ANIMATIONS_JSON_KEY);
  const phaseDurationsByAnimationId = collectPhaseDurationsByAnimationId(debugAnimationManifest);

  const store = new TerrainMapStore(bootstrap.gridSpec);
  const kernel = new MarchingSquaresKernel();
  const mapper = new TerrainCaseMapper(bootstrap.transition.rules);
  const tileResolver = new TerrainTileResolver(
    kernel,
    mapper,
    bootstrap.transition.insideMaterial,
  );
  const chunkBuilder = new TerrainChunkBuilder(store, tileResolver);
  const renderer = new TerrainRenderer(
    scene,
    bootstrap.gridSpec,
    TERRAIN_TEXTURE_KEY,
    phaseDurationsByAnimationId,
  );
  const gameplayGrid = new TerrainGameplayGrid(store, DEFAULT_TERRAIN_MATERIAL_RULES);
  const commands = new TerrainCommands(new TerrainEditRouter(), store, gameplayGrid);
  const queries = new TerrainQueries(store, gameplayGrid, tileResolver);
  const visibleChunks = new TerrainVisibleChunkResolver(
    store.chunkSize,
    store.chunkCountX,
    store.chunkCountY,
  );

  return {
    store,
    chunkBuilder,
    renderer,
    commands,
    queries,
    visibleChunks,
  };
}

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
import {
  TERRAIN_TEXTURE_KEY,
  type TerrainChunkState,
  type TerrainGridSpec,
  type TerrainRenderTile,
} from "./contracts";
import type { TerrainRenderSurface } from "./renderSurface";
import { TerrainMapStore } from "./store";
import { TerrainTileResolver } from "./tileResolver";
import { TerrainVisibleChunkResolver } from "./visibleChunkResolver";
import {
  TerrainRuntime,
  type TerrainRuntimeOptions,
} from "../../engine/terrain";
import type {
  TerrainSeedDetailLayerDocument,
  TerrainSeedDocument,
} from "../../data";
import {
  getFarmrpgStaticTerrainSourceSpecsForDomain,
  resolveFarmrpgStaticTerrainSourceSpec,
  type FarmrpgStaticTerrainPlacementDomain,
} from "../content/asset-catalog/farmrpgTerrainSourceCatalog";
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

export const TERRAIN_DETAIL_EMPTY_SOURCE_ID = "__empty__";

export type TerrainDetailRuntimeContext = {
  placementDomain: FarmrpgStaticTerrainPlacementDomain;
  runtimeOptions: Omit<TerrainRuntimeOptions, "store"> & {
    store: TerrainMapStore;
  };
};

type CreateTerrainDetailRuntimeContextOptions = {
  seedDocument: TerrainSeedDocument;
  gameplayGrid: TerrainGameplayGrid;
  placementDomain: FarmrpgStaticTerrainPlacementDomain;
  staticDepth: number;
  animatedDepth: number;
};

const ANIMATION_MANIFEST_KEY_BY_TERRAIN_TEXTURE: Record<string, string> = {
  "debug.tilesets": DEBUG_ANIMATIONS_JSON_KEY,
  "farmrpg.tilesets": FARMRPG_ANIMATIONS_JSON_KEY,
};

const PREVIEW_RENDER_NEIGHBOR_OFFSETS = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 0 },
] as const;

function resolveTerrainAnimationManifestKey(textureKey: string): string {
  return (
    ANIMATION_MANIFEST_KEY_BY_TERRAIN_TEXTURE[textureKey] ??
    DEBUG_ANIMATIONS_JSON_KEY
  );
}

function resolveDetailLayerDocument(
  seedDocument: TerrainSeedDocument,
  placementDomain: FarmrpgStaticTerrainPlacementDomain,
): TerrainSeedDetailLayerDocument | undefined {
  return placementDomain === "terrain"
    ? seedDocument.terrainDetails
    : seedDocument.officeDetails;
}

function createEmptyDetailRows(seedDocument: TerrainSeedDocument): string[] {
  return Array.from({ length: seedDocument.height }, () =>
    ".".repeat(seedDocument.width),
  );
}

function createTerrainDetailGridSpec(options: {
  seedDocument: TerrainSeedDocument;
  placementDomain: FarmrpgStaticTerrainPlacementDomain;
}): TerrainGridSpec {
  const detailLayer = resolveDetailLayerDocument(
    options.seedDocument,
    options.placementDomain,
  );
  const sourceSpecs = getFarmrpgStaticTerrainSourceSpecsForDomain(
    options.placementDomain,
  );
  const allowedSourceIds = new Set<string>(
    sourceSpecs.map((spec) => spec.sourceId),
  );
  const materials = [
    TERRAIN_DETAIL_EMPTY_SOURCE_ID,
    ...sourceSpecs.map((spec) => spec.sourceId),
  ];
  const rows = detailLayer?.rows ?? createEmptyDetailRows(options.seedDocument);
  const legend = detailLayer?.legend ?? { ".": null };
  const cells: string[] = [];

  for (const [rowIndex, row] of rows.entries()) {
    if (row.length !== options.seedDocument.width) {
      throw new Error(
        `Terrain detail row ${rowIndex} width mismatch: expected ${options.seedDocument.width}, received ${row.length}.`,
      );
    }

    for (const glyph of row) {
      if (!(glyph in legend)) {
        throw new Error(
          `Terrain detail row ${rowIndex} references unknown glyph "${glyph}".`,
        );
      }

      const sourceId = legend[glyph];
      if (sourceId === null) {
        cells.push(TERRAIN_DETAIL_EMPTY_SOURCE_ID);
        continue;
      }

      if (typeof sourceId !== "string" || !allowedSourceIds.has(sourceId)) {
        throw new Error(
          `Terrain detail glyph "${glyph}" maps to unsupported source "${String(sourceId)}" for domain "${options.placementDomain}".`,
        );
      }

      cells.push(sourceId);
    }
  }

  return {
    width: options.seedDocument.width,
    height: options.seedDocument.height,
    chunkSize: options.seedDocument.chunkSize as TerrainGridSpec["chunkSize"],
    defaultMaterial: TERRAIN_DETAIL_EMPTY_SOURCE_ID,
    materials,
    cells,
  };
}

class TerrainDetailTileResolver {
  constructor(private readonly kernel: MarchingSquaresKernel) {}

  public resolveRenderTile(
    materialAt: (cellX: number, cellY: number) => string,
    cellX: number,
    cellY: number,
  ): TerrainRenderTile | null {
    // In dual-grid marching squares, junction (cellX, cellY) covers 4 cells:
    //   NW=(cellX, cellY), NE=(cellX+1, cellY),
    //   SE=(cellX+1, cellY+1), SW=(cellX, cellY+1).
    // A junction tile must render if ANY corner has a detail material, not just NW.
    // We pick the dominant material (NW > NE > SW > SE) and compute the case based
    // on which corners match that material.
    const nwMaterial = materialAt(cellX, cellY);
    const neMaterial = materialAt(cellX + 1, cellY);
    const swMaterial = materialAt(cellX, cellY + 1);
    const seMaterial = materialAt(cellX + 1, cellY + 1);

    const dominantMaterial =
      nwMaterial !== TERRAIN_DETAIL_EMPTY_SOURCE_ID
        ? nwMaterial
        : neMaterial !== TERRAIN_DETAIL_EMPTY_SOURCE_ID
          ? neMaterial
          : swMaterial !== TERRAIN_DETAIL_EMPTY_SOURCE_ID
            ? swMaterial
            : seMaterial !== TERRAIN_DETAIL_EMPTY_SOURCE_ID
              ? seMaterial
              : null;

    if (!dominantMaterial) {
      return null;
    }

    const sourceSpec = resolveFarmrpgStaticTerrainSourceSpec(dominantMaterial);
    if (!sourceSpec) {
      return null;
    }

    const caseId = this.kernel.deriveCaseId(
      materialAt,
      cellX,
      cellY,
      dominantMaterial,
    );
    return {
      cellX,
      cellY,
      caseId,
      frame: `${sourceSpec.framePrefix}${caseId}`,
      rotate90: 0,
      flipX: false,
      flipY: false,
    };
  }
}

class TerrainDetailChunkBuilder {
  constructor(
    private readonly store: TerrainMapStore,
    private readonly tileResolver: TerrainDetailTileResolver,
  ) {}

  public buildChunkPayload(chunk: TerrainChunkState) {
    const tiles: TerrainRenderTile[] = [];
    const bounds = this.store.getChunkCellBounds(chunk.chunkX, chunk.chunkY);
    const materialAt = (cellX: number, cellY: number) =>
      this.store.getCellMaterial(cellX, cellY);

    for (let cellY = bounds.startY; cellY < bounds.endY; cellY += 1) {
      for (let cellX = bounds.startX; cellX < bounds.endX; cellX += 1) {
        const tile = this.tileResolver.resolveRenderTile(
          materialAt,
          cellX,
          cellY,
        );
        if (tile) {
          tiles.push(tile);
        }
      }
    }

    return {
      id: chunk.id,
      chunkX: chunk.chunkX,
      chunkY: chunk.chunkY,
      revision: chunk.revision,
      tiles,
    };
  }
}

class TerrainDetailQueries {
  constructor(
    private readonly store: TerrainMapStore,
    private readonly gameplayGrid: TerrainGameplayGrid,
    private readonly tileResolver: TerrainDetailTileResolver,
  ) {}

  public getGameplayGrid(): TerrainGameplayGrid {
    return this.gameplayGrid;
  }

  public previewPaintAtWorld(
    payload: {
      materialId: string;
      brushId: string;
      screenX: number;
      screenY: number;
      type: "terrain";
    },
    worldX: number,
    worldY: number,
  ): TerrainRenderTile[] | null {
    const center = this.gameplayGrid.worldToCell(worldX, worldY);
    if (!center) {
      return null;
    }

    const previewMaterialId =
      payload.brushId === "delete" || payload.brushId === "eraser"
        ? TERRAIN_DETAIL_EMPTY_SOURCE_ID
        : payload.materialId;
    const materialAt = (cellX: number, cellY: number) =>
      cellX === center.cellX && cellY === center.cellY
        ? previewMaterialId
        : this.store.getCellMaterial(cellX, cellY);
    const tiles: TerrainRenderTile[] = [];

    for (const offset of PREVIEW_RENDER_NEIGHBOR_OFFSETS) {
      const cellX = center.cellX + offset.x;
      const cellY = center.cellY + offset.y;
      if (!this.gameplayGrid.isCellInBounds(cellX, cellY)) {
        continue;
      }

      const tile = this.tileResolver.resolveRenderTile(
        materialAt,
        cellX,
        cellY,
      );
      if (tile) {
        tiles.push(tile);
      }
    }

    return tiles;
  }

  public inspectAtWorld(): null {
    return null;
  }
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

export function createTerrainDetailRuntimeContext(
  scene: TerrainRenderSurface,
  options: CreateTerrainDetailRuntimeContextOptions,
): TerrainDetailRuntimeContext {
  const animationManifest = readOptionalAnimationManifest(
    scene as unknown as Record<string, unknown>,
    resolveTerrainAnimationManifestKey(TERRAIN_TEXTURE_KEY),
  );
  const phaseDurationsByAnimationId =
    collectPhaseDurationsByAnimationId(animationManifest);
  const gridSpec = createTerrainDetailGridSpec({
    seedDocument: options.seedDocument,
    placementDomain: options.placementDomain,
  });
  const store = new TerrainMapStore(gridSpec);
  const kernel = new MarchingSquaresKernel();
  const tileResolver = new TerrainDetailTileResolver(kernel);
  const chunkBuilder = new TerrainDetailChunkBuilder(store, tileResolver);
  const commands = new TerrainCommands(
    new TerrainEditRouter(),
    store,
    options.gameplayGrid,
  );
  const queries = new TerrainDetailQueries(
    store,
    options.gameplayGrid,
    tileResolver,
  );
  const visibleChunks = new TerrainVisibleChunkResolver(
    store.chunkSize,
    store.chunkCountX,
    store.chunkCountY,
  );

  return {
    placementDomain: options.placementDomain,
    runtimeOptions: {
      gridSpec,
      store,
      chunkBuilder,
      commands,
      queries,
      visibleChunks,
      textureKey: TERRAIN_TEXTURE_KEY,
      animationPhaseDurationsById: phaseDurationsByAnimationId,
      staticDepth: options.staticDepth,
      animatedDepth: options.animatedDepth,
    },
  };
}

export function createTerrainRuntime(
  scene: TerrainRenderSurface,
): TerrainRuntime {
  return new TerrainRuntime(scene, createTerrainRuntimeOptions(scene));
}

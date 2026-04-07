import { mapDropPayloadToSpawnRequest } from "../../application/spawnRequestMapper";
import type {
  MobSpawnFailedPayload,
  PlaceEntityDropPayload,
  PlayerPlacedPayload,
  SpawnMobPayload,
} from "../../contracts/runtime";
import type { TerrainRuntime } from "../../../engine";
import type { WorldNavigationService } from "../../../engine/world-runtime/spatial";
import type { EntityRegistry } from "../../world/entities/entityRegistry";
import type { WorldEntity } from "./types";
import { EntitySystem } from "./entitySystem";
import type { WorldSceneProjectionEmitter } from "./worldSceneProjections";

/** Minimal interface for querying which cells have barn.posts detail terrain. */
export type BarnPostsCellQuery = {
  isBarnPostsCell(cellX: number, cellY: number): boolean;
  readonly width: number;
  readonly height: number;
};

type WorldScenePlacementControllerHost = {
  getEntityRegistry: () => EntityRegistry | null;
  getTerrainRuntime: () => TerrainRuntime | null;
  getEntitySystem: () => EntitySystem | null;
  getWorldPoint: (screenX: number, screenY: number) => { x: number; y: number };
  selectEntity: (entity: WorldEntity | null) => void;
  getBarnPostsCellQuery: () => BarnPostsCellQuery | null;
  createMobNavigation: () => WorldNavigationService | null;
};

export class WorldScenePlacementController {
  constructor(
    private readonly host: WorldScenePlacementControllerHost,
    private readonly projections: WorldSceneProjectionEmitter,
  ) {}

  public handlePlaceEntityDrop(payload: PlaceEntityDropPayload): void {
    const entityRegistry = this.host.getEntityRegistry();
    const terrainRuntime = this.host.getTerrainRuntime();
    const entitySystem = this.host.getEntitySystem();
    if (!entityRegistry || !terrainRuntime || !entitySystem) {
      return;
    }

    const spawnRequest = mapDropPayloadToSpawnRequest(payload);
    const runtime = entityRegistry.getRuntimeById(spawnRequest.entityId);
    if (
      !runtime ||
      !runtime.definition.placeable ||
      runtime.definition.kind === "prop"
    ) {
      return;
    }

    const worldPoint = this.host.getWorldPoint(
      spawnRequest.screenX,
      spawnRequest.screenY,
    );
    const clamped = terrainRuntime
      .getGameplayGrid()
      .clampWorldPoint(worldPoint.x, worldPoint.y);
    if (
      !terrainRuntime
        .getGameplayGrid()
        .isWorldWalkable(clamped.worldX, clamped.worldY)
    ) {
      return;
    }

    const entity = entitySystem.addEntity(
      runtime,
      clamped.worldX,
      clamped.worldY,
    );
    if (!entity) {
      return;
    }

    this.host.selectEntity(entity);

    if (runtime.definition.kind === "player") {
      const placedPayload: PlayerPlacedPayload = {
        worldX: clamped.worldX,
        worldY: clamped.worldY,
      };
      this.projections.emitPlayerPlaced(placedPayload);
    }
  }

  public handleSpawnMob(payload: SpawnMobPayload): void {
    const entityRegistry = this.host.getEntityRegistry();
    const terrainRuntime = this.host.getTerrainRuntime();
    const entitySystem = this.host.getEntitySystem();
    const barnPostsQuery = this.host.getBarnPostsCellQuery();
    if (
      !entityRegistry ||
      !terrainRuntime ||
      !entitySystem ||
      !barnPostsQuery
    ) {
      return;
    }

    const runtime = entityRegistry.getRuntimeById(payload.entityId);
    if (
      !runtime ||
      !runtime.definition.placeable ||
      runtime.definition.kind !== "npc"
    ) {
      return;
    }

    const grid = terrainRuntime.getGameplayGrid();
    const spawnPoint = findBarnPostsSpawnPoint(barnPostsQuery, grid);

    if (!spawnPoint) {
      const failedPayload: MobSpawnFailedPayload = {
        entityId: payload.entityId,
        reason: "no-valid-spawn-area",
      };
      this.projections.emitMobSpawnFailed(failedPayload);
      return;
    }

    const navigation = this.host.createMobNavigation();
    const entity = entitySystem.addEntity(
      runtime,
      spawnPoint.worldX,
      spawnPoint.worldY,
      navigation ? { navigation } : {},
    );
    if (!entity) {
      return;
    }

    this.host.selectEntity(entity);
  }
}

type GameplayGridView = ReturnType<TerrainRuntime["getGameplayGrid"]>;

function findBarnPostsSpawnPoint(
  barnPostsQuery: BarnPostsCellQuery,
  grid: GameplayGridView,
): { worldX: number; worldY: number } | null {
  const candidates: Array<{ cellX: number; cellY: number }> = [];

  for (let cellY = 0; cellY < barnPostsQuery.height; cellY++) {
    for (let cellX = 0; cellX < barnPostsQuery.width; cellX++) {
      if (
        barnPostsQuery.isBarnPostsCell(cellX, cellY) &&
        grid.isCellWalkable(cellX, cellY)
      ) {
        candidates.push({ cellX, cellY });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)]!;
  return grid.cellToWorldCenter(chosen.cellX, chosen.cellY);
}

import { mapDropPayloadToSpawnRequest } from "../../application/spawnRequestMapper";
import type {
  PlaceEntityDropPayload,
  PlayerPlacedPayload,
  SpawnEntityPayload,
} from "../../contracts/runtime";
import type { TerrainRuntime } from "../../../engine";
import type { EntityRegistry } from "../../world/entities/entityRegistry";
import type { WorldEntity } from "./types";
import { EntitySystem } from "./entitySystem";
import type { WorldSceneProjectionEmitter } from "./worldSceneProjections";

type WorldScenePlacementControllerHost = {
  getEntityRegistry: () => EntityRegistry | null;
  getTerrainRuntime: () => TerrainRuntime | null;
  getEntitySystem: () => EntitySystem | null;
  getWorldPoint: (screenX: number, screenY: number) => { x: number; y: number };
  getCameraCenter: () => { x: number; y: number };
  selectEntity: (entity: WorldEntity | null) => void;
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

  public handleSpawnEntity(payload: SpawnEntityPayload): void {
    const entityRegistry = this.host.getEntityRegistry();
    const terrainRuntime = this.host.getTerrainRuntime();
    const entitySystem = this.host.getEntitySystem();
    if (!entityRegistry || !terrainRuntime || !entitySystem) {
      return;
    }

    const runtime = entityRegistry.getRuntimeById(payload.entityId);
    if (
      !runtime ||
      !runtime.definition.placeable ||
      runtime.definition.kind === "prop"
    ) {
      return;
    }

    const center = this.host.getCameraCenter();
    const clamped = terrainRuntime
      .getGameplayGrid()
      .clampWorldPoint(center.x, center.y);
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
}

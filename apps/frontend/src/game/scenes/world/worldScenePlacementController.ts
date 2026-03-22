import { mapDropPayloadToSpawnRequest } from "../../application/spawnRequestMapper";
import type {
  PlaceObjectDropPayload,
  PlayerPlacedPayload,
} from "../../protocol";
import type { EntityRegistry } from "../../domain/entityRegistry";
import type { TerrainSystem } from "../../terrain";
import type { WorldEntity } from "./types";
import { EntitySystem } from "./entitySystem";
import type { WorldSceneProjectionEmitter } from "./worldSceneProjections";

type WorldScenePlacementControllerHost = {
  getEntityRegistry: () => EntityRegistry | null;
  getTerrainSystem: () => TerrainSystem | null;
  getEntitySystem: () => EntitySystem | null;
  getWorldPoint: (screenX: number, screenY: number) => { x: number; y: number };
  selectEntity: (entity: WorldEntity | null) => void;
};

export class WorldScenePlacementController {
  constructor(
    private readonly host: WorldScenePlacementControllerHost,
    private readonly projections: WorldSceneProjectionEmitter,
  ) {}

  public handlePlaceObjectDrop(payload: PlaceObjectDropPayload): void {
    const entityRegistry = this.host.getEntityRegistry();
    const terrainSystem = this.host.getTerrainSystem();
    const entitySystem = this.host.getEntitySystem();
    if (!entityRegistry || !terrainSystem || !entitySystem) {
      return;
    }

    const spawnRequest = mapDropPayloadToSpawnRequest(payload);
    const runtime = entityRegistry.getRuntimeById(spawnRequest.entityId);
    if (!runtime || !runtime.definition.placeable) {
      return;
    }

    const worldPoint = this.host.getWorldPoint(
      spawnRequest.screenX,
      spawnRequest.screenY,
    );
    const clamped = terrainSystem
      .getGameplayGrid()
      .clampWorldPoint(worldPoint.x, worldPoint.y);
    if (
      !terrainSystem
        .getGameplayGrid()
        .isWorldWalkable(clamped.worldX, clamped.worldY)
    ) {
      return;
    }

    const entity = entitySystem.addEntity(runtime, clamped.worldX, clamped.worldY);
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

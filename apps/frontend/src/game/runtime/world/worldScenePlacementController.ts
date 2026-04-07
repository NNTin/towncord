import { mapDropPayloadToSpawnRequest } from "../../application/spawnRequestMapper";
import type {
  PlaceEntityDropPayload,
  PlayerPlacedPayload,
  SpawnEntityPayload,
} from "../../contracts/runtime";
import type { OfficeSceneFurniture } from "../../contracts/office-scene";
import {
  anchoredGridCellToWorldPixel,
  type AnchoredGridRegion,
} from "../../../engine/world-runtime/regions";
import type { TerrainRuntime } from "../../../engine/terrain";
import type { EntityRegistry } from "../../world/entities/entityRegistry";
import type { OfficeSceneBootstrap } from "../../contracts/office-scene";
import type { WorldEntity } from "./types";
import { EntitySystem } from "./entitySystem";
import type { WorldSceneProjectionEmitter } from "./worldSceneProjections";

type OfficeRegion = AnchoredGridRegion<OfficeSceneBootstrap["layout"]>;

type WorldScenePlacementControllerHost = {
  getEntityRegistry: () => EntityRegistry | null;
  getTerrainRuntime: () => TerrainRuntime | null;
  getEntitySystem: () => EntitySystem | null;
  getWorldPoint: (screenX: number, screenY: number) => { x: number; y: number };
  getCameraCenter: () => { x: number; y: number };
  getOfficeRegion: () => OfficeRegion | null;
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
    const entitySystem = this.host.getEntitySystem();
    if (!entityRegistry || !entitySystem) {
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

    const spawnPoint = this.pickRandomChairPosition();
    if (!spawnPoint) {
      return;
    }

    const entity = entitySystem.addEntity(runtime, spawnPoint.x, spawnPoint.y);
    if (!entity) {
      return;
    }

    entitySystem.enableAutoplay();
    this.host.selectEntity(entity);

    if (runtime.definition.kind === "player") {
      const placedPayload: PlayerPlacedPayload = {
        worldX: spawnPoint.x,
        worldY: spawnPoint.y,
      };
      this.projections.emitPlayerPlaced(placedPayload);
    }
  }

  private pickRandomChairPosition(): { x: number; y: number } | null {
    const officeRegion = this.host.getOfficeRegion();
    if (!officeRegion) {
      return null;
    }

    const chairs = officeRegion.layout.furniture.filter(
      (f): f is OfficeSceneFurniture =>
        f.category === "chairs" && f.placement === "floor",
    );
    if (chairs.length === 0) {
      return null;
    }

    const chair = chairs[Math.floor(Math.random() * chairs.length)]!;
    const { worldX, worldY } = anchoredGridCellToWorldPixel(
      chair.col,
      chair.row,
      officeRegion,
    );
    const half = officeRegion.layout.cellSize / 2;
    return { x: worldX + half, y: worldY + half };
  }
}

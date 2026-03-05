import type { AnimationCatalog } from "../assets/animationCatalog";
import { buildAnimationCatalog } from "../assets/animationCatalog";
import type { EntityRegistry } from "../domain/entityRegistry";
import { buildEntityRegistryFromCatalog } from "./entityRegistryBuilder";
import { PlaceableService, type PlaceableViewModel } from "./placeableService";

export type BloomseedWorldBootstrap = {
  catalog: AnimationCatalog;
  entityRegistry: EntityRegistry;
};

export type BloomseedUiBootstrap = {
  catalog: AnimationCatalog;
  placeables: PlaceableViewModel[];
};

export type BloomseedBootstrap = {
  world: BloomseedWorldBootstrap;
  ui: BloomseedUiBootstrap;
};

export const BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY = "bloomseed.worldBootstrap";
export const BLOOMSEED_READY_EVENT = "bloomseedReady";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getBloomseedWorldBootstrap(value: unknown): BloomseedWorldBootstrap | null {
  if (!isObjectRecord(value)) return null;
  if (!("catalog" in value) || !("entityRegistry" in value)) return null;
  return value as BloomseedWorldBootstrap;
}

export function composeBloomseedBootstrap(animationKeys: string[]): BloomseedBootstrap {
  const catalog = buildAnimationCatalog(animationKeys);
  const entityRegistry = buildEntityRegistryFromCatalog(catalog);
  const placeableService = PlaceableService.fromRegistry(entityRegistry);
  const placeables = placeableService.listPlaceables();

  return {
    world: {
      catalog,
      entityRegistry,
    },
    ui: {
      catalog,
      placeables,
    },
  };
}

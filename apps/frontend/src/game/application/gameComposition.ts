import type { AnimationCatalog } from "../assets/animationCatalog";
import { buildAnimationCatalog } from "../assets/animationCatalog";
import type { EntityRegistry } from "../domain/entityRegistry";
import { isRecord } from "../utils/typeGuards";
import { buildEntityRegistryFromCatalog } from "./entityRegistryBuilder";
import {
  listEntityPlaceables,
  type PlaceableViewModel,
} from "./placeableService";
import { listTerrainPlaceables } from "./terrainPlaceableCatalog";

type BloomseedWorldBootstrap = {
  catalog: AnimationCatalog;
  entityRegistry: EntityRegistry;
};

export type BloomseedUiBootstrap = {
  catalog: AnimationCatalog;
  placeables: PlaceableViewModel[];
};

type BloomseedBootstrap = {
  world: BloomseedWorldBootstrap;
  ui: BloomseedUiBootstrap;
};

export const BLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY = "bloomseed.worldBootstrap";
export const BLOOMSEED_READY_EVENT = "bloomseedReady";

export function getBloomseedWorldBootstrap(value: unknown): BloomseedWorldBootstrap | null {
  if (!isRecord(value)) return null;
  if (!("catalog" in value) || !("entityRegistry" in value)) return null;
  return value as BloomseedWorldBootstrap;
}

export function composeBloomseedBootstrap(animationKeys: string[]): BloomseedBootstrap {
  const catalog = buildAnimationCatalog(animationKeys);
  const entityRegistry = buildEntityRegistryFromCatalog(catalog);
  const placeables = [
    ...listEntityPlaceables(entityRegistry),
    ...listTerrainPlaceables(),
  ];

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

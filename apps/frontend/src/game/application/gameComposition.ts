import type { AnimationCatalog } from "../assets/animationCatalog";
import { buildAnimationCatalog } from "../assets/animationCatalog";
import type { EntityRegistry } from "../domain/entityRegistry";
import type { RuntimeBootstrapPayload } from "../protocol";
import { isRecord } from "../utils/typeGuards";
import { buildEntityRegistryFromCatalog } from "./entityRegistryBuilder";
import { listEntityPlaceables } from "./placeableService";
import { listTerrainPlaceables } from "./terrainPlaceableCatalog";

export type WorldBootstrap = {
  catalog: AnimationCatalog;
  entityRegistry: EntityRegistry;
};

type RuntimeBootstrapBundle = {
  world: WorldBootstrap;
  ui: RuntimeBootstrapPayload;
};

export const WORLD_BOOTSTRAP_REGISTRY_KEY = "worldBootstrap";

export function getWorldBootstrap(value: unknown): WorldBootstrap | null {
  if (!isRecord(value)) return null;
  if (!("catalog" in value) || !("entityRegistry" in value)) return null;
  return value as WorldBootstrap;
}

export function composeRuntimeBootstrap(animationKeys: string[]): RuntimeBootstrapBundle {
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

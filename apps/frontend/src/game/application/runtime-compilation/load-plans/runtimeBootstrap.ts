import type { AnimationCatalog } from "../../../content/asset-catalog/animationCatalog";
import { buildAnimationCatalog } from "../../../content/asset-catalog/animationCatalog";
import type { RuntimeBootstrapPayload } from "../../../contracts/runtime";
import { isRecord } from "../../../utils/typeGuards";
import type { EntityRegistry } from "../../../world/entities/entityRegistry";
import { buildEntityRegistryFromCatalog } from "../../entityRegistryBuilder";
import { listEntityPlaceables } from "../../placeableService";
import { listTerrainPlaceables } from "../../terrainPlaceableCatalog";

export type WorldBootstrap = {
  catalog: AnimationCatalog;
  entityRegistry: EntityRegistry;
};

type RuntimeBootstrapBundle = {
  world: WorldBootstrap;
  ui: RuntimeBootstrapPayload;
};

export const WORLD_BOOTSTRAP_REGISTRY_KEY = "worldBootstrap";
export const UI_BOOTSTRAP_REGISTRY_KEY = "uiBootstrap";

export function getWorldBootstrap(value: unknown): WorldBootstrap | null {
  if (!isRecord(value)) return null;
  if (!("catalog" in value) || !("entityRegistry" in value)) return null;
  return value as WorldBootstrap;
}

export function composeRuntimeBootstrap(
  animationKeys: string[],
): RuntimeBootstrapBundle {
  const catalog = buildAnimationCatalog(animationKeys);
  const entityRegistry = buildEntityRegistryFromCatalog(catalog);
  const placeables = [
    ...listEntityPlaceables(entityRegistry, catalog),
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

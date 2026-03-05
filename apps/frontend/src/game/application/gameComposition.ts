import type { AnimationCatalog } from "../assets/animationCatalog";
import { buildAnimationCatalog } from "../assets/animationCatalog";
import type { EntityRegistry } from "../domain/entityRegistry";
import { buildEntityRegistryFromCatalog } from "./entityRegistryBuilder";
import { PlaceableService } from "./placeableService";

export type BloomseedGameContext = {
  catalog: AnimationCatalog;
  entityRegistry: EntityRegistry;
  placeableService: PlaceableService;
};

export const BLOOMSEED_GAME_CONTEXT_REGISTRY_KEY = "bloomseed.gameContext";
export const BLOOMSEED_READY_EVENT = "bloomseedReady";

export function composeBloomseedGameContext(animationKeys: string[]): BloomseedGameContext {
  const catalog = buildAnimationCatalog(animationKeys);
  const entityRegistry = buildEntityRegistryFromCatalog(catalog);

  return {
    catalog,
    entityRegistry,
    placeableService: PlaceableService.fromRegistry(entityRegistry),
  };
}

import { listMobDescriptors, type AnimationCatalog } from "../assets/animationCatalog";
import {
  buildArchetypeRuntimes,
  type NpcArchetypeSeed,
  type PlayerArchetypeSeed,
} from "../domain/archetypes";
import { RuntimeEntityRegistry } from "../domain/entityRegistry";
import { createEntityVisualRef } from "../domain/model";

function buildPlayerSeeds(catalog: AnimationCatalog): PlayerArchetypeSeed[] {
  return catalog.playerModels.map((model) => ({
    model,
    visualRef: createEntityVisualRef(`player/${model}`),
  }));
}

function buildNpcSeeds(catalog: AnimationCatalog): NpcArchetypeSeed[] {
  return listMobDescriptors(catalog).map(({ family, mobId, visualPath }) => ({
    family,
    mobId,
    visualRef: createEntityVisualRef(visualPath),
  }));
}

export function buildEntityRegistryFromCatalog(catalog: AnimationCatalog): RuntimeEntityRegistry {
  const runtimes = buildArchetypeRuntimes({
    players: buildPlayerSeeds(catalog),
    npcs: buildNpcSeeds(catalog),
  });

  return RuntimeEntityRegistry.fromRuntimes(runtimes);
}

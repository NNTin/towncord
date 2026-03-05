import type { AnimationCatalog } from "../assets/animationCatalog";
import {
  buildArchetypeRuntimes,
  type NpcArchetypeSeed,
  type PlayerArchetypeSeed,
} from "../domain/archetypes";
import { RuntimeEntityRegistry } from "../domain/entityRegistry";
import { createCatalogPathRef } from "../domain/model";

function buildPlayerSeeds(catalog: AnimationCatalog): PlayerArchetypeSeed[] {
  return catalog.playerModels.map((model) => ({
    model,
    catalogPath: createCatalogPathRef(`player/${model}`),
  }));
}

function buildNpcSeeds(catalog: AnimationCatalog): NpcArchetypeSeed[] {
  const seeds: NpcArchetypeSeed[] = [];

  for (const path of catalog.tracksByPath.keys()) {
    const [ns, family, mobId, extra] = path.split("/");
    if (ns !== "mobs" || !family || !mobId || extra) continue;

    seeds.push({
      family,
      mobId,
      catalogPath: createCatalogPathRef(path),
    });
  }

  return seeds;
}

export function buildEntityRegistryFromCatalog(catalog: AnimationCatalog): RuntimeEntityRegistry {
  const runtimes = buildArchetypeRuntimes({
    players: buildPlayerSeeds(catalog),
    npcs: buildNpcSeeds(catalog),
  });

  return RuntimeEntityRegistry.fromRuntimes(runtimes);
}

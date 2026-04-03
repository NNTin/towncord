import {
  listMobDescriptors,
  listOfficeCharacterDescriptors,
  type AnimationCatalog,
} from "../content/asset-catalog/animationCatalog";
import {
  buildArchetypeRuntimes,
  type NpcArchetypeSeed,
  type PlayerArchetypeSeed,
} from "../world/entities/archetypes";
import { RuntimeEntityRegistry } from "../world/entities/entityRegistry";
import { createEntityVisualRef } from "../world/entities/model";

const TOOLBAR_OFFICE_WORKER_PALETTES = new Set([
  "palette-0",
  "palette-1",
  "palette-2",
  "palette-3",
  "palette-4",
]);

function formatEntityLabel(value: string): string {
  return value
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatOfficeWorkerLabel(palette: string, characterId: string): string {
  const paletteMatch = /^palette-(\d+)$/.exec(palette);
  if (!paletteMatch) {
    return `${formatEntityLabel(characterId)} ${formatEntityLabel(palette)}`;
  }

  const paletteNumber = Number.parseInt(paletteMatch[1]!, 10) + 1;
  return `${formatEntityLabel(characterId)} ${paletteNumber}`;
}

function buildPlayerSeeds(catalog: AnimationCatalog): PlayerArchetypeSeed[] {
  const playerSeeds = catalog.playerModels.map((model) => ({
    model,
    visualRef: createEntityVisualRef(`player/${model}`),
  }));
  const officeWorkerSeeds = listOfficeCharacterDescriptors(catalog)
    .filter(
      ({ palette, characterId }) =>
        characterId === "office-worker" &&
        TOOLBAR_OFFICE_WORKER_PALETTES.has(palette),
    )
    .sort(
      (left, right) =>
        left.palette.localeCompare(right.palette) ||
        left.characterId.localeCompare(right.characterId),
    )
    .map(({ palette, characterId, visualPath }) => ({
      model: `office.${palette}.${characterId}`,
      label: formatOfficeWorkerLabel(palette, characterId),
      visualRef: createEntityVisualRef(visualPath),
    }));

  return [...playerSeeds, ...officeWorkerSeeds];
}

function buildNpcSeeds(catalog: AnimationCatalog): NpcArchetypeSeed[] {
  return listMobDescriptors(catalog).map(({ family, mobId, visualPath }) => ({
    family,
    mobId,
    visualRef: createEntityVisualRef(visualPath),
  }));
}

export function buildEntityRegistryFromCatalog(
  catalog: AnimationCatalog,
): RuntimeEntityRegistry {
  const runtimes = buildArchetypeRuntimes({
    players: buildPlayerSeeds(catalog),
    npcs: buildNpcSeeds(catalog),
  });

  return RuntimeEntityRegistry.fromRuntimes(runtimes);
}

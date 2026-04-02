import type { TerrainRulesetFile } from "../../../data";

export type FarmrpgStaticTerrainSourceSpec = {
  sourceId: `public-assets:terrain/${string}`;
  id: string;
  label: string;
  groupKey: string;
  groupLabel: string;
  framePrefix: `tilesets.farmrpg.${string}#`;
  representativeCaseId: number;
};

export const FARMRPG_STATIC_TERRAIN_SOURCE_SPECS = [
  {
    sourceId: "public-assets:terrain/farmrpg-barn-posts",
    id: "terrain.farmrpg.barn.posts",
    label: "Barn Posts",
    groupKey: "farmrpg-barn",
    groupLabel: "Barn",
    framePrefix: "tilesets.farmrpg.barn.posts#",
    representativeCaseId: 15,
  },
  {
    sourceId: "public-assets:terrain/farmrpg-barn-hay",
    id: "terrain.farmrpg.barn.hay",
    label: "Barn Hay",
    groupKey: "farmrpg-barn",
    groupLabel: "Barn",
    framePrefix: "tilesets.farmrpg.barn.hay#",
    representativeCaseId: 15,
  },
  {
    sourceId: "public-assets:terrain/farmrpg-barn-messy-hay",
    id: "terrain.farmrpg.barn.messy-hay",
    label: "Barn Messy Hay",
    groupKey: "farmrpg-barn",
    groupLabel: "Barn",
    framePrefix: "tilesets.farmrpg.barn.messy-hay#",
    representativeCaseId: 15,
  },
  {
    sourceId: "public-assets:terrain/farmrpg-carpet-01",
    id: "terrain.farmrpg.carpet.variant-01",
    label: "Carpet 01",
    groupKey: "farmrpg-carpet",
    groupLabel: "Carpet",
    framePrefix: "tilesets.farmrpg.carpet.variant-01#",
    representativeCaseId: 15,
  },
  {
    sourceId: "public-assets:terrain/farmrpg-carpet-02",
    id: "terrain.farmrpg.carpet.variant-02",
    label: "Carpet 02",
    groupKey: "farmrpg-carpet",
    groupLabel: "Carpet",
    framePrefix: "tilesets.farmrpg.carpet.variant-02#",
    representativeCaseId: 15,
  },
  {
    sourceId: "public-assets:terrain/farmrpg-carpet-03",
    id: "terrain.farmrpg.carpet.variant-03",
    label: "Carpet 03",
    groupKey: "farmrpg-carpet",
    groupLabel: "Carpet",
    framePrefix: "tilesets.farmrpg.carpet.variant-03#",
    representativeCaseId: 15,
  },
  {
    sourceId: "public-assets:terrain/farmrpg-soil-tilled-01",
    id: "terrain.farmrpg.soil.tilled.variant-01",
    label: "Tilled Soil 01",
    groupKey: "farmrpg-soil",
    groupLabel: "Soil",
    framePrefix: "tilesets.farmrpg.soil.tilled.variant-01#",
    representativeCaseId: 15,
  },
  {
    sourceId: "public-assets:terrain/farmrpg-soil-wet-01",
    id: "terrain.farmrpg.soil.wet.variant-01",
    label: "Wet Soil 01",
    groupKey: "farmrpg-soil",
    groupLabel: "Soil",
    framePrefix: "tilesets.farmrpg.soil.wet.variant-01#",
    representativeCaseId: 15,
  },
  {
    sourceId: "public-assets:terrain/farmrpg-soil-tilled-02",
    id: "terrain.farmrpg.soil.tilled.variant-02",
    label: "Tilled Soil 02",
    groupKey: "farmrpg-soil",
    groupLabel: "Soil",
    framePrefix: "tilesets.farmrpg.soil.tilled.variant-02#",
    representativeCaseId: 15,
  },
  {
    sourceId: "public-assets:terrain/farmrpg-soil-wet-02",
    id: "terrain.farmrpg.soil.wet.variant-02",
    label: "Wet Soil 02",
    groupKey: "farmrpg-soil",
    groupLabel: "Soil",
    framePrefix: "tilesets.farmrpg.soil.wet.variant-02#",
    representativeCaseId: 15,
  },
] as const satisfies readonly FarmrpgStaticTerrainSourceSpec[];

export type FarmrpgStaticTerrainSourceId =
  (typeof FARMRPG_STATIC_TERRAIN_SOURCE_SPECS)[number]["sourceId"];

export function createFarmrpgAutotileRuleset(
  framePrefix: `tilesets.farmrpg.${string}#`,
): TerrainRulesetFile {
  return {
    transitions: [
      {
        id: `${framePrefix.slice(0, -1).replace(/\./g, "-")}-over-ground`,
        insideMaterial: "water",
        outsideMaterial: "ground",
        rules: Array.from({ length: 16 }, (_, caseId) => ({
          caseId,
          frame: `${framePrefix}${caseId}`,
        })),
      },
    ],
  };
}

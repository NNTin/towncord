import type Phaser from "phaser";
import {
  TERRAIN_CHUNK_SIZE,
  TERRAIN_TEXTURE_KEY,
  type TerrainGridSpec,
  type TerrainMaterialId,
} from "./contracts";
import type { TerrainRulesetFile, TerrainTransitionRuleset } from "./ruleset";
import rulesetFixture from "./data/ruleset.phase1.json";
import seedFixture from "./data/seed.phase1.json";

type TerrainSeedFixture = {
  width: number;
  height: number;
  chunkSize: number;
  defaultMaterial: TerrainMaterialId;
  materials: TerrainMaterialId[];
  legend: Record<string, TerrainMaterialId>;
  rows: string[];
};

type TerrainBootstrap = {
  gridSpec: TerrainGridSpec;
  transition: TerrainTransitionRuleset;
};

function toTerrainGridSpec(fixture: TerrainSeedFixture): TerrainGridSpec {
  const { width, height, chunkSize, defaultMaterial, materials, legend, rows } = fixture;
  const cells: TerrainMaterialId[] = [];

  if (rows.length !== height) {
    throw new Error(
      `Terrain seed rows mismatch: expected ${height}, received ${rows.length}.`,
    );
  }

  for (const [rowIndex, row] of rows.entries()) {
    if (row.length !== width) {
      throw new Error(
        `Terrain seed row ${rowIndex} width mismatch: expected ${width}, received ${row.length}.`,
      );
    }

    for (const glyph of row) {
      const material = legend[glyph];
      if (!material) {
        throw new Error(`Terrain seed row ${rowIndex} has unknown glyph \"${glyph}\".`);
      }
      cells.push(material);
    }
  }

  return {
    width,
    height,
    chunkSize: chunkSize as TerrainGridSpec["chunkSize"],
    defaultMaterial,
    materials,
    cells,
  };
}

export function loadTerrainBootstrap(): TerrainBootstrap {
  const parsedSeed = seedFixture as TerrainSeedFixture;
  const parsedRules = rulesetFixture as TerrainRulesetFile;
  const transition = parsedRules.transitions[0];

  if (!transition) {
    throw new Error("Terrain ruleset fixture has no transitions.");
  }

  return {
    gridSpec: toTerrainGridSpec(parsedSeed),
    transition,
  };
}

export function validateTerrainBootstrap(
  scene: Phaser.Scene,
  bootstrap: TerrainBootstrap,
  textureKey: string = TERRAIN_TEXTURE_KEY,
): void {
  const errors: string[] = [];
  const { gridSpec, transition } = bootstrap;
  const { width, height, chunkSize, materials, defaultMaterial, cells } = gridSpec;

  if (chunkSize !== TERRAIN_CHUNK_SIZE) {
    errors.push(`chunkSize must be ${TERRAIN_CHUNK_SIZE}, got ${chunkSize}.`);
  }

  if (width % chunkSize !== 0 || height % chunkSize !== 0) {
    errors.push(
      `grid dimensions must be divisible by chunkSize. width=${width}, height=${height}, chunkSize=${chunkSize}.`,
    );
  }

  if (cells.length !== width * height) {
    errors.push(`cells length mismatch. expected ${width * height}, got ${cells.length}.`);
  }

  if (!materials.includes(defaultMaterial)) {
    errors.push(`defaultMaterial \"${defaultMaterial}\" is missing from materials.`);
  }

  for (const material of cells) {
    if (!materials.includes(material)) {
      errors.push(`cell has unknown material \"${material}\".`);
      break;
    }
  }

  if (!materials.includes(transition.insideMaterial)) {
    errors.push(`transition insideMaterial \"${transition.insideMaterial}\" not in grid materials.`);
  }

  if (!materials.includes(transition.outsideMaterial)) {
    errors.push(`transition outsideMaterial \"${transition.outsideMaterial}\" not in grid materials.`);
  }

  if (transition.rules.length !== 16) {
    errors.push(`transition must provide 16 rules, got ${transition.rules.length}.`);
  }

  const caseIds = new Set<number>();
  for (const rule of transition.rules) {
    if (rule.caseId < 0 || rule.caseId > 15) {
      errors.push(`rule caseId out of range: ${rule.caseId}.`);
    }
    caseIds.add(rule.caseId);
  }

  if (caseIds.size !== 16) {
    errors.push(`rules must map each case id 0..15 exactly once. unique count=${caseIds.size}.`);
  }

  if (!scene.textures.exists(textureKey)) {
    errors.push(`texture key \"${textureKey}\" is not loaded.`);
  } else {
    const texture = scene.textures.get(textureKey);
    for (const rule of transition.rules) {
      if (!texture.has(rule.frame)) {
        errors.push(
          `mapped frame missing from texture \"${textureKey}\": case ${rule.caseId} -> \"${rule.frame}\".`,
        );
      }
    }
  }

  if (errors.length === 0) return;

  const message = `Terrain bootstrap validation failed:\n- ${errors.join("\n- ")}`;
  if (import.meta.env.DEV) {
    throw new Error(message);
  }

  console.error(message);
  throw new Error("Terrain bootstrap validation failed.");
}

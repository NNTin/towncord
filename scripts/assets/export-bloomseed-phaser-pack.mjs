#!/usr/bin/env node

import { promises as fs } from "node:fs";
import os from "node:os";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const rootDir = process.cwd();
const sourceRoot = path.resolve(rootDir, "assets/sprites");
const frontendPublicRoot = path.resolve(rootDir, "apps/frontend/public");
const phaserRoot = path.join(frontendPublicRoot, "assets/bloomseed");
const atlasRoot = path.join(phaserRoot, "atlases");
const imageToolsPath = path.resolve(rootDir, "scripts/assets/image-tools.py");
const dryRun = process.argv.slice(2).includes("--dry-run");
const execFileAsync = promisify(execFile);

/**
 * Mob asset IDs whose source sprites naturally face left and must be flipped
 * during atlas packing so all exported side-facing frames face right by
 * convention, letting the runtime use a single uniform flip rule.
 */
const FLIP_X_MOB_ASSET_IDS = new Set([
  "mobs.bloomseed.animals.cow.cow-idle-side",
  "mobs.bloomseed.animals.cow.cow-walk-side",
  "mobs.bloomseed.animals.chicken.chicken-sleep-side",
  "mobs.bloomseed.animals.chicken.chicken-pet",
]);

/**
 * Returns true when a frame from this asset must be horizontally flipped
 * before being written into the atlas.  After packing, every side-facing
 * sprite faces right, so the runtime only needs to flip for leftward movement.
 */
function needsFlipX(asset) {
  const { id } = asset;
  // Player character tool-side animations face left in the source sheets.
  if (id.startsWith("characters.bloomseed.player.") && id.includes(".tool.") && id.endsWith("-side")) {
    return true;
  }
  // Equipment side frames overlay character tool-side sprites and share the same orientation.
  if (id.startsWith("equipment.bloomseed.") && id.endsWith("-side")) {
    return true;
  }
  // Mob-specific cases enumerated explicitly above.
  return FLIP_X_MOB_ASSET_IDS.has(id);
}

async function main() {
  const sourceManifest = await readJson(path.join(sourceRoot, "manifest.json"));
  const categoryManifests = await Promise.all(
    sourceManifest.categories.map(async (category) => {
      const manifestPath = path.join(sourceRoot, category.manifestPath);
      return readJson(manifestPath);
    }),
  );

  if (!dryRun) {
    await fs.rm(phaserRoot, { recursive: true, force: true });
    await fs.mkdir(atlasRoot, { recursive: true });
  }

  const atlasOutputs = [];

  for (const manifest of categoryManifests) {
    const frames = buildFrameList(manifest.assets);
    const atlasKey = `bloomseed.${manifest.category}`;
    const imageRelative = `assets/bloomseed/atlases/${manifest.category}.png`;
    const jsonRelative = `assets/bloomseed/atlases/${manifest.category}.json`;
    const outputImage = path.join(atlasRoot, `${manifest.category}.png`);
    const outputAtlasJson = path.join(atlasRoot, `${manifest.category}.json`);

    const packResult = await packCategoryAtlas({
      atlasName: manifest.category,
      frames,
      outputImage,
      outputAtlasJson,
    });

    atlasOutputs.push({
      category: manifest.category,
      atlasKey,
      textureURL: imageRelative,
      atlasURL: jsonRelative,
      frameCount: packResult.frameCount,
      width: packResult.width,
      height: packResult.height,
    });
  }

  const animations = buildAnimationIndex(categoryManifests);
  const pack = buildPack(sourceManifest, atlasOutputs);

  if (!dryRun) {
    await writeJson(path.join(phaserRoot, "animations.json"), animations);
    await writeJson(path.join(phaserRoot, "manifest.json"), {
      namespace: sourceManifest.namespace,
      atlases: atlasOutputs,
      animationCount: Object.keys(animations.animations).length,
    });
    await writeJson(path.join(phaserRoot, "pack.json"), pack);
  }

  console.log(
    `${dryRun ? "Dry run completed" : "Export completed"}: ${atlasOutputs.length} atlases.`,
  );

  for (const atlas of atlasOutputs) {
    console.log(
      `- ${atlas.category}: ${atlas.frameCount} frames, ${atlas.width}x${atlas.height}`,
    );
  }
}

function buildFrameList(assets) {
  const frames = [];

  for (const asset of assets) {
    const sourceFile = path.join(sourceRoot, asset.outputPath);

    const flipX = needsFlipX(asset);

    if (asset.layout?.type === "strip") {
      for (let index = 0; index < asset.layout.frameCount; index += 1) {
        frames.push({
          name: `${asset.id}#${index}`,
          source: sourceFile,
          rect: {
            x: index * asset.layout.frameWidth,
            y: 0,
            w: asset.layout.frameWidth,
            h: asset.layout.frameHeight,
          },
          w: asset.layout.frameWidth,
          h: asset.layout.frameHeight,
          flipX,
        });
      }
      continue;
    }

    if (asset.layout?.type === "sheet") {
      let index = 0;
      for (let row = 0; row < asset.layout.rows; row += 1) {
        for (let column = 0; column < asset.layout.columns; column += 1) {
          frames.push({
            name: `${asset.id}#${index}`,
            source: sourceFile,
            rect: {
              x: column * asset.layout.cellWidth,
              y: row * asset.layout.cellHeight,
              w: asset.layout.cellWidth,
              h: asset.layout.cellHeight,
            },
            w: asset.layout.cellWidth,
            h: asset.layout.cellHeight,
            flipX,
          });
          index += 1;
        }
      }
      continue;
    }

    frames.push({
      name: asset.id,
      source: sourceFile,
      rect: {
        x: 0,
        y: 0,
        w: asset.image.width,
        h: asset.image.height,
      },
      w: asset.image.width,
      h: asset.image.height,
      flipX,
    });
  }

  return frames;
}

async function packCategoryAtlas({
  atlasName,
  frames,
  outputImage,
  outputAtlasJson,
}) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bloomseed-atlas-"));
  const inputJsonPath = path.join(tempDir, `${atlasName}.json`);
  await writeJson(inputJsonPath, { atlasName, frames });

  const commandArgs = [
    imageToolsPath,
    "pack",
    "--input-json",
    inputJsonPath,
    "--output-image",
    outputImage,
    "--output-atlas-json",
    outputAtlasJson,
    "--max-width",
    "2048",
    "--padding",
    "2",
  ];

  if (dryRun) {
    commandArgs.push("--dry-run");
  }

  try {
    const { stdout } = await execFileAsync("python3", commandArgs, {
      maxBuffer: 16 * 1024 * 1024,
    });
    return JSON.parse(stdout.trim());
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function buildAnimationIndex(categoryManifests) {
  const animations = {};

  for (const manifest of categoryManifests) {
    const atlasKey = `bloomseed.${manifest.category}`;

    for (const asset of manifest.assets) {
      if (isAggregatePropSheet(asset.id)) {
        continue;
      }

      const frames = resolveAnimationFrames(asset);
      if (frames.length === 0) {
        continue;
      }

      if (asset.id.startsWith("props.bloomseed.static.")) {
        const segments = asset.id.split(".");
        const groupId = segments[3];
        if (!groupId) {
          continue;
        }

        const digits = Math.max(2, String(frames.length).length);
        for (let index = 0; index < frames.length; index += 1) {
          const variantId = `variant-${String(index + 1).padStart(digits, "0")}`;
          const animationId = `props.bloomseed.static.${groupId}.${variantId}`;
          animations[animationId] = {
            atlasKey,
            frames: [frames[index]],
          };
        }
        continue;
      }

      animations[asset.id] = {
        atlasKey,
        frames,
      };
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    namespace: "bloomseed",
    animations,
  };
}

function resolveAnimationFrames(asset) {
  if (asset.layout?.type === "strip") {
    return Array.from({ length: asset.layout.frameCount }, (_, index) => (
      `${asset.id}#${index}`
    ));
  }

  if (asset.layout?.type === "sheet") {
    const frameCount = asset.layout.columns * asset.layout.rows;
    return Array.from({ length: frameCount }, (_, index) => (
      `${asset.id}#${index}`
    ));
  }

  return [asset.id];
}

function isAggregatePropSheet(assetId) {
  if (!assetId.startsWith("props.bloomseed.")) {
    return false;
  }

  const lastSegment = assetId.split(".").pop() ?? "";
  return lastSegment.startsWith("all-");
}

function buildPack(sourceManifest, atlasOutputs) {
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      generator: "scripts/assets/export-bloomseed-phaser-pack.mjs",
      namespace: sourceManifest.namespace,
      sourceManifest: "assets/sprites/manifest.json",
      publicRoot: "apps/frontend/public/assets/bloomseed",
      format: "phaser-asset-pack",
    },
    bloomseed: {
      files: [
        ...atlasOutputs.map((atlas) => ({
          type: "atlas",
          key: atlas.atlasKey,
          textureURL: atlas.textureURL,
          atlasURL: atlas.atlasURL,
        })),
        {
          type: "json",
          key: "bloomseed.animations",
          url: "assets/bloomseed/animations.json",
        },
      ],
    },
  };
}

async function readJson(filePath) {
  const contents = await fs.readFile(filePath, "utf8");
  return JSON.parse(contents);
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

await main();

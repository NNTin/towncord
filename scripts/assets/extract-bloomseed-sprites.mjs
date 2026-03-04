#!/usr/bin/env node

import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { bloomseedConfig } from "./config/bloomseed.map.mjs";

const rootDir = process.cwd();
const sourceRoot = path.resolve(rootDir, bloomseedConfig.sourceRoot);
const targetRoot = path.resolve(rootDir, bloomseedConfig.targetRoot);
const imageToolsPath = path.resolve(rootDir, "scripts/assets/image-tools.py");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const execFileAsync = promisify(execFile);

const sortedRules = [...bloomseedConfig.rules].sort(
  (left, right) => right.source.length - left.source.length,
);

async function main() {
  const files = await walkFiles(sourceRoot);
  const assets = [];
  const skipped = [];
  const unmatched = [];

  for (const absoluteFile of files) {
    const relativePath = toPosix(path.relative(sourceRoot, absoluteFile));
    const extension = path.extname(relativePath).toLowerCase();

    if (shouldIgnore(relativePath, extension)) {
      skipped.push(relativePath);
      continue;
    }

    const rule = matchRule(relativePath);

    if (!rule) {
      unmatched.push(relativePath);
      continue;
    }

    const png = extension === ".png" ? await readPngSize(absoluteFile) : null;
    const sourceSegments = relativePath.split("/");
    const stem = path.basename(relativePath, extension);
    const outputRelativePath = buildOutputPath(relativePath, rule);
    const parsed = parseName(stem);
    const layout = buildLayout(rule, png);

    assets.push({
      id: buildAssetId(rule.target, stem),
      namespace: bloomseedConfig.namespace,
      kind: rule.kind,
      atlas: rule.atlas,
      sourcePath: relativePath,
      outputPath: outputRelativePath,
      sourceSegments,
      parsed,
      tags: sortUnique([...(rule.tags ?? []), ...parsed.tags]),
      sourceImage: png
        ? {
            width: png.width,
            height: png.height,
            format: "png",
          }
        : null,
      image: png
        ? {
            width: png.width,
            height: png.height,
            format: "png",
          }
        : null,
      layout,
      trim: null,
    });
  }

  if (unmatched.length > 0) {
    console.error("Unmatched Bloomseed files:");
    for (const file of unmatched) {
      console.error(`- ${file}`);
    }
    process.exitCode = 1;
    return;
  }

  await processAssets(assets);
  const manifests = buildManifests(assets, skipped);
  await writeManifests(manifests);

  const trimSummary = summarizeTrim(assets);

  console.log(
    `${dryRun ? "Dry run completed" : "Import completed"}: ${assets.length} assets, ${skipped.length} skipped.`,
  );
  for (const [name, manifest] of Object.entries(manifests.byCategory)) {
    console.log(`- ${name}: ${manifest.assets.length} assets`);
  }
  console.log(
    `- trimming: ${trimSummary.trimmedAssets}/${trimSummary.totalAssets} images trimmed, ${trimSummary.pixelsRemoved} pixels removed`,
  );
}

function shouldIgnore(relativePath, extension) {
  return (
    bloomseedConfig.ignoredFiles.includes(relativePath) ||
    bloomseedConfig.ignoredExtensions.includes(extension)
  );
}

function matchRule(relativePath) {
  return sortedRules.find((rule) => {
    return (
      relativePath === rule.source ||
      relativePath.startsWith(`${rule.source}/`)
    );
  });
}

function buildOutputPath(relativePath, rule) {
  const sourcePrefix = `${rule.source}/`;
  const remainder =
    relativePath === rule.source
      ? path.basename(relativePath)
      : relativePath.startsWith(sourcePrefix)
        ? relativePath.slice(sourcePrefix.length)
        : path.basename(relativePath);

  const normalizedRemainder = remainder
    .split("/")
    .map((segment, index, segments) => {
      if (index === segments.length - 1) {
        const extension = path.extname(segment).toLowerCase();
        const stem = segment.slice(0, segment.length - extension.length);
        return `${slugify(stem)}${extension}`;
      }
      return slugify(segment);
    })
    .join("/");

  return toPosix(path.join(rule.target, normalizedRemainder));
}

function buildAssetId(target, stem) {
  return toPosix(path.join(target, slugify(stem))).replaceAll("/", ".");
}

function buildLayout(rule, png) {
  if (!png) {
    return null;
  }

  if (rule.parser === "strip") {
    const frameWidth = rule.defaults?.frameWidth ?? png.height;
    const frameHeight = rule.defaults?.frameHeight ?? png.height;
    const frameCount = Math.max(1, Math.floor(png.width / frameWidth));
    const remainderX = png.width % frameWidth;

    return {
      type: "strip",
      frameWidth,
      frameHeight,
      frameCount,
      columns: frameCount,
      rows: 1,
      remainderX,
      exact: remainderX === 0,
    };
  }

  if (rule.parser === "sheet") {
    const cellWidth = rule.defaults?.cellWidth ?? png.width;
    const cellHeight = rule.defaults?.cellHeight ?? png.height;
    const columns = Math.max(1, Math.floor(png.width / cellWidth));
    const rows = Math.max(1, Math.floor(png.height / cellHeight));
    const remainderX = png.width % cellWidth;
    const remainderY = png.height % cellHeight;

    return {
      type: "sheet",
      cellWidth,
      cellHeight,
      columns,
      rows,
      remainderX,
      remainderY,
      exact: remainderX === 0 && remainderY === 0,
    };
  }

  return {
    type: "single",
    frameWidth: png.width,
    frameHeight: png.height,
    frameCount: 1,
    exact: true,
  };
}

function parseName(stem) {
  const tokens = stem.split("_").map((token) => token.trim()).filter(Boolean);
  const tags = [];
  const lowerTokens = tokens.map((token) => token.toLowerCase());
  const direction = pickToken(lowerTokens, ["up", "down", "side"]);
  const material = pickToken(lowerTokens, ["wood", "iron", "gold"]);
  const state = pickToken(lowerTokens, [
    "idle",
    "walk",
    "run",
    "sleep",
    "eat",
    "pet",
    "attack",
    "alert",
    "death",
    "hit",
    "jump",
    "leap",
    "collapse",
    "slash",
    "stab",
    "smash",
    "watering",
  ]);

  if (direction) {
    tags.push(direction);
  }
  if (material) {
    tags.push(material);
  }
  if (state) {
    tags.push(state);
  }

  return {
    stem,
    slug: slugify(stem),
    tokens: lowerTokens,
    direction,
    material,
    state,
    tags,
  };
}

function pickToken(tokens, candidates) {
  return tokens.find((token) => candidates.includes(token)) ?? null;
}

function buildManifests(assets, skipped) {
  const grouped = new Map();

  for (const asset of assets) {
    const category = asset.outputPath.split("/")[0];
    const items = grouped.get(category) ?? [];
    items.push(asset);
    grouped.set(category, items);
  }

  const byCategory = {};

  for (const [category, items] of [...grouped.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    byCategory[category] = {
      category,
      namespace: bloomseedConfig.namespace,
      assetCount: items.length,
      assets: items.sort((left, right) => left.id.localeCompare(right.id)),
    };
  }

  return {
    index: {
      namespace: bloomseedConfig.namespace,
      sourceRoot: bloomseedConfig.sourceRoot,
      targetRoot: bloomseedConfig.targetRoot,
      assetCount: assets.length,
      skipped,
      categories: Object.keys(byCategory).sort().map((category) => ({
        name: category,
        manifestPath: `${category}/manifest.json`,
        assetCount: byCategory[category].assetCount,
      })),
    },
    byCategory,
  };
}

async function processAssets(assets) {
  if (!dryRun) {
    await fs.mkdir(targetRoot, { recursive: true });
  }

  for (const asset of assets) {
    const sourceFile = path.resolve(sourceRoot, asset.sourcePath);
    const destinationFile = path.resolve(targetRoot, asset.outputPath);

    if (path.extname(sourceFile).toLowerCase() !== ".png" || !asset.layout) {
      if (!dryRun) {
        await fs.mkdir(path.dirname(destinationFile), { recursive: true });
        await fs.copyFile(sourceFile, destinationFile);
      }
      continue;
    }

    const trimResult = await trimAndCopyImage({
      sourceFile,
      destinationFile,
      layout: asset.layout,
    });

    asset.image = trimResult.image;
    asset.layout = trimResult.layout;
    asset.trim = trimResult.trim;
  }
}

async function trimAndCopyImage({ sourceFile, destinationFile, layout }) {
  const commandArgs = [
    imageToolsPath,
    "trim",
    "--src",
    sourceFile,
    "--layout-json",
    JSON.stringify(layout),
  ];

  if (dryRun) {
    commandArgs.push("--dry-run");
  } else {
    commandArgs.push("--dest", destinationFile);
  }

  const { stdout } = await execFileAsync("python3", commandArgs, {
    maxBuffer: 8 * 1024 * 1024,
  });

  return JSON.parse(stdout.trim());
}

async function writeManifests(manifests) {
  if (dryRun) {
    return;
  }

  await writeJson(path.join(targetRoot, "manifest.json"), manifests.index);

  for (const [category, manifest] of Object.entries(manifests.byCategory)) {
    await writeJson(path.join(targetRoot, category, "manifest.json"), manifest);
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function walkFiles(startDir) {
  const entries = await fs.readdir(startDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(startDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolutePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

async function readPngSize(filePath) {
  const handle = await fs.open(filePath, "r");
  const buffer = Buffer.alloc(24);

  try {
    await handle.read(buffer, 0, buffer.length, 0);
  } finally {
    await handle.close();
  }

  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) {
    throw new Error(`Not a PNG file: ${filePath}`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function slugify(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
}

function sortUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function summarizeTrim(assets) {
  let trimmedAssets = 0;
  let pixelsRemoved = 0;

  for (const asset of assets) {
    if (!asset.sourceImage || !asset.image) {
      continue;
    }

    const originalArea = asset.sourceImage.width * asset.sourceImage.height;
    const trimmedArea = asset.image.width * asset.image.height;

    if (trimmedArea < originalArea) {
      trimmedAssets += 1;
      pixelsRemoved += originalArea - trimmedArea;
    }
  }

  return {
    totalAssets: assets.length,
    trimmedAssets,
    pixelsRemoved,
  };
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

await main();

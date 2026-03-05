#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const rootDir = process.cwd();
const spritesRoot = path.resolve(rootDir, "assets/sprites");
const debugRoot = path.resolve(rootDir, "assets/debug");
const imageToolsPath = path.resolve(rootDir, "scripts/assets/image-tools.py");
const dryRun = process.argv.slice(2).includes("--dry-run");
const execFileAsync = promisify(execFile);

async function main() {
  const sourceManifest = await readJson(path.join(spritesRoot, "manifest.json"));
  const categoryManifests = await Promise.all(
    sourceManifest.categories.map(async (category) => {
      const manifestPath = path.join(spritesRoot, category.manifestPath);
      return readJson(manifestPath);
    }),
  );

  if (!dryRun) {
    await fs.rm(debugRoot, { recursive: true, force: true });
    await fs.mkdir(debugRoot, { recursive: true });
  }

  let generated = 0;
  let skipped = 0;

  for (const manifest of categoryManifests) {
    for (const asset of manifest.assets) {
      if (!shouldGenerateGif(asset)) {
        skipped += 1;
        continue;
      }

      const sourcePath = path.join(spritesRoot, asset.outputPath);
      const relativeGifPath = replaceExtension(asset.outputPath, ".gif");
      const outputPath = path.join(debugRoot, relativeGifPath);

      const args = [
        imageToolsPath,
        "gif",
        "--src",
        sourcePath,
        "--layout-json",
        JSON.stringify(asset.layout),
        "--fps",
        resolveFps(asset),
      ];

      if (!dryRun) {
        args.push("--dest", outputPath);
      }

      if (dryRun) {
        args.push("--dry-run");
      }

      await execFileAsync("python3", args, {
        maxBuffer: 16 * 1024 * 1024,
      });

      generated += 1;
    }
  }

  console.log(
    `${dryRun ? "Dry run completed" : "Debug GIF export completed"}: ${generated} GIFs generated, ${skipped} assets skipped.`,
  );
  console.log(`- output: ${path.relative(rootDir, debugRoot)}`);
}

function shouldGenerateGif(asset) {
  const layout = asset.layout;
  if (!layout || typeof layout !== "object") {
    return false;
  }

  if (layout.type === "strip") {
    return Number(layout.frameCount ?? 0) > 1;
  }

  if (layout.type === "sheet") {
    const frameCount = Number(layout.columns ?? 0) * Number(layout.rows ?? 0);
    const tags = Array.isArray(asset.tags) ? asset.tags : [];
    return frameCount > 1 && tags.includes("animated");
  }

  return false;
}

function resolveFps(asset) {
  const tags = Array.isArray(asset.tags) ? asset.tags : [];

  if (tags.includes("idle")) {
    return "6";
  }

  if (tags.includes("walk") || tags.includes("run")) {
    return "10";
  }

  return "8";
}

function replaceExtension(filePath, extension) {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${extension}`);
}

async function readJson(filePath) {
  const contents = await fs.readFile(filePath, "utf8");
  return JSON.parse(contents);
}

await main();

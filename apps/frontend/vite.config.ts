import fs from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import type { Plugin, ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { createOfficeLayoutDevAdapter } from "./data-dev/structures/office-layout/officeLayoutDevAdapter";
import { createTerrainSeedDevAdapter } from "./data-dev/world-seeds/terrain-seed/terrainSeedDevAdapter";
import {
  PUBLIC_ASSETS_JSON_PREFIX,
  createPublicJsonImportModuleId,
  resolvePublicJsonImportFilePath,
  resolvePublicJsonImportRelativeAssetPath,
} from "./publicJsonImport";

const PUBLIC_ASSETS_ROOT = path.resolve(__dirname, "./public/assets");
const OFFICE_LAYOUT_PATH = path.resolve(
  __dirname,
  "./public/assets/office/default-layout.json",
);
const TERRAIN_SEED_PATH = path.resolve(
  __dirname,
  "./public/assets/terrain/seeds/phase1.json",
);
const DONARG_OFFICE_ASSETS_ROOT = path.resolve(
  __dirname,
  "../../packages/donarg-office-assets/assets",
);
const BLOOMSEED_ATLAS_FALLBACK_PATH = path.resolve(
  __dirname,
  "./src/assets/bloomseed-atlas-fallback.json",
);

const PUBLIC_JSON_FALLBACKS = new Map<string, string>([
  ["donarg-office/atlas.json", path.resolve(DONARG_OFFICE_ASSETS_ROOT, "atlas.json")],
  ["office/default-layout.json", OFFICE_LAYOUT_PATH],
  [
    "donarg-office/furniture-catalog.json",
    path.resolve(DONARG_OFFICE_ASSETS_ROOT, "furniture/furniture-catalog.json"),
  ],
  ["bloomseed/atlas.json", BLOOMSEED_ATLAS_FALLBACK_PATH],
]);

function publicJsonImportPlugin(): Plugin {
  return {
    name: "towncord-public-json-import",
    resolveId(source: string) {
      if (!source.startsWith(PUBLIC_ASSETS_JSON_PREFIX)) {
        return null;
      }

      const relativeAssetPath = source.slice(PUBLIC_ASSETS_JSON_PREFIX.length);
      return createPublicJsonImportModuleId(relativeAssetPath);
    },
    async load(id: string) {
      if (!id.startsWith(`\0${PUBLIC_ASSETS_JSON_PREFIX}`)) {
        return null;
      }

      const relativeAssetPath = Buffer.from(
        id.slice(`\0${PUBLIC_ASSETS_JSON_PREFIX}`.length),
        "base64url",
      ).toString("utf8");
      const filePath = await resolvePublicJsonImportFilePath(relativeAssetPath, {
        publicAssetsRoot: PUBLIC_ASSETS_ROOT,
        fallbackEntries: PUBLIC_JSON_FALLBACKS,
      });
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return `export default ${JSON.stringify(parsed)};`;
    },
    configureServer(server: ViteDevServer) {
      const invalidateRelativeAsset = (relativeAssetPath: string): void => {
        const moduleId = createPublicJsonImportModuleId(relativeAssetPath);
        const module = server.moduleGraph.getModuleById(moduleId);
        if (module) {
          server.moduleGraph.invalidateModule(module);
        }
      };

      const invalidateFromFilePath = (filePath: string): void => {
        const relativeAssetPath = resolvePublicJsonImportRelativeAssetPath(filePath, {
          publicAssetsRoot: PUBLIC_ASSETS_ROOT,
          fallbackEntries: PUBLIC_JSON_FALLBACKS,
        });

        if (relativeAssetPath) {
          invalidateRelativeAsset(relativeAssetPath);
        }
      };

      server.watcher.on("add", invalidateFromFilePath);
      server.watcher.on("change", invalidateFromFilePath);
      server.watcher.on("unlink", invalidateFromFilePath);
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    publicJsonImportPlugin(),
    react(),
    command === "serve"
      ? createOfficeLayoutDevAdapter({
          canonicalLayoutPath: OFFICE_LAYOUT_PATH,
        })
      : null,
    command === "serve"
      ? createTerrainSeedDevAdapter({
          canonicalSeedPath: TERRAIN_SEED_PATH,
          relativeAssetPath: "terrain/seeds/phase1.json",
        })
      : null,
  ].filter(Boolean),
  base: process.env.BASE_PATH ?? "/",
}));

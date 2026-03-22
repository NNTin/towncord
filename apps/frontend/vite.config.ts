import fs from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import type { Plugin, ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { createOfficeLayoutDevAdapter } from "./officeLayoutDevAdapter";
import {
  PUBLIC_ASSETS_JSON_PREFIX,
  createPublicJsonImportModuleId,
  resolvePublicJsonImportRelativeAssetPath,
} from "./publicJsonImport";

const PUBLIC_ASSETS_ROOT = path.resolve(__dirname, "./public/assets");
const OFFICE_LAYOUT_PATH = path.resolve(
  __dirname,
  "../../packages/donarg-office-assets/assets/default-layout.json",
);
const DONARG_OFFICE_ASSETS_ROOT = path.resolve(
  __dirname,
  "../../packages/donarg-office-assets/assets",
);
const PUBLIC_OFFICE_LAYOUT_PATH = path.resolve(
  __dirname,
  "./public/assets/donarg-office/default-layout.json",
);

const PUBLIC_JSON_FALLBACKS = new Map<string, string>([
  ["donarg-office/atlas.json", path.resolve(DONARG_OFFICE_ASSETS_ROOT, "atlas.json")],
  ["donarg-office/default-layout.json", OFFICE_LAYOUT_PATH],
  [
    "donarg-office/furniture-catalog.json",
    path.resolve(DONARG_OFFICE_ASSETS_ROOT, "furniture/furniture-catalog.json"),
  ],
]);

async function resolvePublicJsonPath(relativeAssetPath: string): Promise<string> {
  const publicPath = path.resolve(PUBLIC_ASSETS_ROOT, relativeAssetPath);

  try {
    await fs.access(publicPath);
    return publicPath;
  } catch (error) {
    const fallbackPath = PUBLIC_JSON_FALLBACKS.get(relativeAssetPath);
    if (!fallbackPath) {
      throw error;
    }

    return fallbackPath;
  }
}

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
      const filePath = await resolvePublicJsonPath(relativeAssetPath);
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
          fallbackEntries: Array.from(PUBLIC_JSON_FALLBACKS.entries()),
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
          publicLayoutPath: PUBLIC_OFFICE_LAYOUT_PATH,
        })
      : null,
  ].filter(Boolean),
  base: process.env.BASE_PATH ?? "/",
}));

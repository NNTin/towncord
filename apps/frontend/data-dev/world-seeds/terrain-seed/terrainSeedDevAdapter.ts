import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { createPublicJsonImportModuleId } from "../../../publicJsonImport";
import { TERRAIN_SEED_DEV_ROUTE } from "../../../src/data/world-seeds/terrainSeedContracts";
import {
  isTerrainSeedDocument,
  type TerrainSeedDocument,
} from "../../../src/data/world-seeds/terrainSeedDocument";

type TerrainSeedFileSystemAdapter = {
  read(): Promise<TerrainSeedDocument>;
  readMetadata(): Promise<{
    path: string;
    updatedAt: string;
  }>;
  write(seed: TerrainSeedDocument): Promise<void>;
};

type TerrainSeedDevAdapterOptions = {
  canonicalSeedPath: string;
};

function createTerrainSeedFileSystemAdapter(
  options: TerrainSeedDevAdapterOptions,
): TerrainSeedFileSystemAdapter {
  async function read(): Promise<TerrainSeedDocument> {
    const raw = await fs.readFile(options.canonicalSeedPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!isTerrainSeedDocument(parsed)) {
      throw new Error(
        "Canonical terrain seed JSON does not match the expected document shape.",
      );
    }

    return parsed;
  }

  return {
    read,
    async readMetadata() {
      const stat = await fs.stat(options.canonicalSeedPath);
      return {
        path: options.canonicalSeedPath,
        updatedAt: stat.mtime.toISOString(),
      };
    },
    async write(seed) {
      if (!isTerrainSeedDocument(seed)) {
        throw new Error("Refusing to persist an invalid terrain seed document.");
      }

      await fs.writeFile(
        options.canonicalSeedPath,
        `${JSON.stringify(seed, null, 2)}\n`,
        "utf8",
      );
    },
  };
}

async function readBody(req: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

export function createTerrainSeedDevAdapter(
  options: TerrainSeedDevAdapterOptions,
): Plugin {
  const fileSystemAdapter = createTerrainSeedFileSystemAdapter(options);
  const terrainSeedModuleId = createPublicJsonImportModuleId(
    "terrain/seeds/phase1.json",
  );

  const invalidateTerrainSeedModule = (server: ViteDevServer): void => {
    const module = server.moduleGraph.getModuleById(terrainSeedModuleId);

    if (module) {
      server.moduleGraph.invalidateModule(module);
    }
  };

  return {
    name: "towncord-terrain-seed-dev-api",
    configureServer(server: ViteDevServer) {
      server.watcher.on("change", (filePath) => {
        if (path.resolve(filePath) === path.resolve(options.canonicalSeedPath)) {
          invalidateTerrainSeedModule(server);
        }
      });

      server.middlewares.use(TERRAIN_SEED_DEV_ROUTE, async (req, res) => {
        const sendJson = (
          statusCode: number,
          payload: Record<string, unknown>,
        ) => {
          res.statusCode = statusCode;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(payload));
        };

        try {
          if (req.method === "GET") {
            const [seed, metadata] = await Promise.all([
              fileSystemAdapter.read(),
              fileSystemAdapter.readMetadata(),
            ]);

            sendJson(200, {
              path: metadata.path,
              updatedAt: metadata.updatedAt,
              document: seed,
            });
            return;
          }

          if (req.method === "PUT") {
            const body = await readBody(req);
            const parsed = JSON.parse(body) as unknown;
            if (!isTerrainSeedDocument(parsed)) {
              sendJson(400, { error: "Invalid terrain seed document." });
              return;
            }

            await fileSystemAdapter.write(parsed);
            invalidateTerrainSeedModule(server);
            const metadata = await fileSystemAdapter.readMetadata();
            sendJson(200, {
              path: metadata.path,
              updatedAt: metadata.updatedAt,
              document: parsed,
            });
            return;
          }

          if (req.method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
          }

          sendJson(405, { error: "Method not allowed." });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown terrain seed API error.";
          sendJson(500, { error: message });
        }
      });
    },
  };
}

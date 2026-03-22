import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import { OFFICE_LAYOUT_DEV_ROUTE } from "./src/app/officeLayoutContracts";
import { isOfficeLayoutDocument, type OfficeLayoutDocument } from "./src/app/officeLayoutDocument";

type OfficeLayoutFileSystemAdapter = {
  read(): Promise<OfficeLayoutDocument>;
  readMetadata(): Promise<{
    path: string;
    updatedAt: string;
  }>;
  write(layout: OfficeLayoutDocument): Promise<void>;
  syncPublicCopy(): Promise<void>;
};

type OfficeLayoutDevAdapterOptions = {
  canonicalLayoutPath: string;
  publicLayoutPath: string;
};

function createOfficeLayoutFileSystemAdapter(
  options: OfficeLayoutDevAdapterOptions,
): OfficeLayoutFileSystemAdapter {
  async function read(): Promise<OfficeLayoutDocument> {
    const raw = await fs.readFile(options.canonicalLayoutPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!isOfficeLayoutDocument(parsed)) {
      throw new Error("Canonical office layout JSON does not match the expected document shape.");
    }

    return parsed;
  }

  async function writePublicCopy(layout: OfficeLayoutDocument): Promise<void> {
    if (!isOfficeLayoutDocument(layout)) {
      throw new Error("Refusing to persist an invalid office layout document.");
    }

    await fs.mkdir(path.dirname(options.publicLayoutPath), { recursive: true });
    await fs.writeFile(
      options.publicLayoutPath,
      `${JSON.stringify(layout, null, 2)}\n`,
      "utf8",
    );
  }

  return {
    read,
    async readMetadata() {
      const stat = await fs.stat(options.canonicalLayoutPath);
      return {
        path: options.canonicalLayoutPath,
        updatedAt: stat.mtime.toISOString(),
      };
    },
    async write(layout) {
      if (!isOfficeLayoutDocument(layout)) {
        throw new Error("Refusing to persist an invalid office layout document.");
      }

      await fs.writeFile(
        options.canonicalLayoutPath,
        `${JSON.stringify(layout, null, 2)}\n`,
        "utf8",
      );
      await writePublicCopy(layout);
    },
    async syncPublicCopy() {
      await writePublicCopy(await read());
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

export function createOfficeLayoutDevAdapter(
  options: OfficeLayoutDevAdapterOptions,
): Plugin {
  const fileSystemAdapter = createOfficeLayoutFileSystemAdapter(options);

  return {
    name: "towncord-office-layout-dev-api",
    configureServer(server: ViteDevServer) {
      void fileSystemAdapter.syncPublicCopy().catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unknown office layout sync error.";
        server.config.logger.error(message);
      });

      server.middlewares.use(OFFICE_LAYOUT_DEV_ROUTE, async (req, res) => {
        const sendJson = (statusCode: number, payload: Record<string, unknown>) => {
          res.statusCode = statusCode;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(payload));
        };

        try {
          if (req.method === "GET") {
            const [layout, metadata] = await Promise.all([
              fileSystemAdapter.read(),
              fileSystemAdapter.readMetadata(),
            ]);

            sendJson(200, {
              path: metadata.path,
              updatedAt: metadata.updatedAt,
              layout,
            });
            return;
          }

          if (req.method === "PUT") {
            const body = await readBody(req);
            const parsed = JSON.parse(body) as unknown;
            if (!isOfficeLayoutDocument(parsed)) {
              sendJson(400, { error: "Invalid office layout document." });
              return;
            }

            await fileSystemAdapter.write(parsed);
            const metadata = await fileSystemAdapter.readMetadata();
            sendJson(200, {
              path: metadata.path,
              updatedAt: metadata.updatedAt,
              layout: parsed,
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
            error instanceof Error ? error.message : "Unknown office layout API error.";
          sendJson(500, { error: message });
        }
      });
    },
  };
}

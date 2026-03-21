import fs from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { isOfficeLayoutDocument, type OfficeLayoutDocument } from "./src/app/officeLayoutDocument";

const OFFICE_LAYOUT_ROUTE = "/__office-layout";
const PUBLIC_ASSETS_JSON_PREFIX = "public-assets-json:";
const OFFICE_LAYOUT_PATH = path.resolve(
  __dirname,
  "../../packages/donarg-office-assets/assets/default-layout.json",
);
const PUBLIC_OFFICE_LAYOUT_PATH = path.resolve(
  __dirname,
  "./public/assets/donarg-office/default-layout.json",
);

function publicJsonImportPlugin() {
  return {
    name: "towncord-public-json-import",
    resolveId(source: string) {
      if (!source.startsWith(PUBLIC_ASSETS_JSON_PREFIX)) {
        return null;
      }

      const relativeAssetPath = source.slice(PUBLIC_ASSETS_JSON_PREFIX.length);
      return `\0${PUBLIC_ASSETS_JSON_PREFIX}${Buffer.from(
        path.resolve(__dirname, `./public/assets/${relativeAssetPath}`),
      ).toString("base64url")}`;
    },
    async load(id: string) {
      if (!id.startsWith(`\0${PUBLIC_ASSETS_JSON_PREFIX}`)) {
        return null;
      }

      const filePath = Buffer.from(
        id.slice(`\0${PUBLIC_ASSETS_JSON_PREFIX}`.length),
        "base64url",
      ).toString("utf8");
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return `export default ${JSON.stringify(parsed)};`;
    },
  };
}

async function readOfficeLayout(): Promise<OfficeLayoutDocument> {
  const raw = await fs.readFile(OFFICE_LAYOUT_PATH, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!isOfficeLayoutDocument(parsed)) {
    throw new Error("Canonical office layout JSON does not match the expected document shape.");
  }

  return parsed;
}

async function writeOfficeLayout(layout: OfficeLayoutDocument): Promise<void> {
  if (!isOfficeLayoutDocument(layout)) {
    throw new Error("Refusing to persist an invalid office layout document.");
  }

  const payload = `${JSON.stringify(layout, null, 2)}\n`;
  await fs.writeFile(
    OFFICE_LAYOUT_PATH,
    payload,
    "utf8",
  );
  await writePublicOfficeLayout(layout);
}

async function writePublicOfficeLayout(layout: OfficeLayoutDocument): Promise<void> {
  if (!isOfficeLayoutDocument(layout)) {
    throw new Error("Refusing to persist an invalid office layout document.");
  }

  const payload = `${JSON.stringify(layout, null, 2)}\n`;
  await fs.mkdir(path.dirname(PUBLIC_OFFICE_LAYOUT_PATH), { recursive: true });
  await fs.writeFile(
    PUBLIC_OFFICE_LAYOUT_PATH,
    payload,
    "utf8",
  );
}

async function syncPublicOfficeLayout(): Promise<void> {
  const layout = await readOfficeLayout();
  await writePublicOfficeLayout(layout);
}

async function readBody(req: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function officeLayoutDevPlugin() {
  return {
    name: "towncord-office-layout-dev-api",
    configureServer(server: import("vite").ViteDevServer) {
      void syncPublicOfficeLayout().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unknown office layout sync error.";
        server.config.logger.error(message);
      });

      server.middlewares.use(OFFICE_LAYOUT_ROUTE, async (req, res) => {
        const sendJson = (statusCode: number, payload: Record<string, unknown>) => {
          res.statusCode = statusCode;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(payload));
        };

        try {
          if (req.method === "GET") {
            const layout = await readOfficeLayout();
            const stat = await fs.stat(OFFICE_LAYOUT_PATH);
            sendJson(200, {
              path: OFFICE_LAYOUT_PATH,
              updatedAt: stat.mtime.toISOString(),
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

            await writeOfficeLayout(parsed);
            const stat = await fs.stat(OFFICE_LAYOUT_PATH);
            sendJson(200, {
              path: OFFICE_LAYOUT_PATH,
              updatedAt: stat.mtime.toISOString(),
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
          const message = error instanceof Error ? error.message : "Unknown office layout API error.";
          sendJson(500, { error: message });
        }
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [publicJsonImportPlugin(), react(), command === "serve" ? officeLayoutDevPlugin() : null].filter(Boolean),
  base: process.env.BASE_PATH ?? "/",
}));

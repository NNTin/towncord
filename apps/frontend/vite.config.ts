import fs from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

type OfficeLayoutDocument = {
  version: number;
  cols: number;
  rows: number;
  tiles: unknown[];
  tileColors?: unknown[];
  furniture?: unknown[];
  characters?: unknown[];
  [key: string]: unknown;
};

const OFFICE_LAYOUT_ROUTE = "/__office-layout";
const OFFICE_LAYOUT_PATH = path.resolve(
  __dirname,
  "../../packages/donarg-office-assets/assets/default-layout.json",
);

function isOfficeLayoutDocument(value: unknown): value is OfficeLayoutDocument {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.version === "number" &&
    typeof candidate.cols === "number" &&
    typeof candidate.rows === "number" &&
    Array.isArray(candidate.tiles)
  );
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

  await fs.writeFile(
    OFFICE_LAYOUT_PATH,
    `${JSON.stringify(layout, null, 2)}\n`,
    "utf8",
  );
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
  plugins: [react(), command === "serve" ? officeLayoutDevPlugin() : null].filter(Boolean),
  base: process.env.BASE_PATH ?? "/",
}));

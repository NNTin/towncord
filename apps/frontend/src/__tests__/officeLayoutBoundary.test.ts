import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { OFFICE_LAYOUT_DEV_ROUTE } from "../data/structures/office-layout/officeLayoutContracts";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(TEST_DIR, "../..");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");
const CONFIG_ROOT = path.join(SRC_ROOT, "config");
const DATA_ROOT = path.join(SRC_ROOT, "data");
const DATA_STRUCTURES_ROOT = path.join(DATA_ROOT, "structures");
const DATA_OFFICE_LAYOUT_ROOT = path.join(
  DATA_STRUCTURES_ROOT,
  "office-layout",
);
const GAME_ROOT = path.join(SRC_ROOT, "game");
const TELEMETRY_ROOT = path.join(SRC_ROOT, "telemetry");
const UI_ROOT = path.join(SRC_ROOT, "ui");
const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx"]);
const DATA_DEV_ADAPTER_PATH = path.join(
  FRONTEND_ROOT,
  "data-dev",
  "structures",
  "office-layout",
  "officeLayoutDevAdapter.ts",
);
const UI_EDITOR_HOOK_PATH = path.join(
  SRC_ROOT,
  "ui",
  "editors",
  "office-layout",
  "draft-state",
  "useOfficeLayoutEditor.ts",
);
const GAME_EDITOR_SERVICE_PATH = path.join(
  SRC_ROOT,
  "game",
  "application",
  "use-cases",
  "officeLayoutEditorService.ts",
);
const OLD_SESSION_EDITOR_PATH = path.join(
  SRC_ROOT,
  "game",
  "session",
  "office-layout",
  "useOfficeLayoutEditor.ts",
);
const OLD_DATA_OFFICE_LAYOUT_ROOT = path.join(DATA_ROOT, "office-layout");
const OLD_DATA_FRONTEND_CONFIG_PATH = path.join(
  OLD_DATA_OFFICE_LAYOUT_ROOT,
  "frontendConfig.ts",
);
const OLD_DATA_TELEMETRY_PATH = path.join(
  OLD_DATA_OFFICE_LAYOUT_ROOT,
  "frontendTelemetry.ts",
);
const GAME_DOCUMENT_IMPORT_OWNER_PATH = path.join(
  GAME_ROOT,
  "content",
  "document-import",
  "officeLayoutDocument.ts",
);
const GAME_DOCUMENT_EXPORT_OWNER_PATH = path.join(
  GAME_ROOT,
  "content",
  "document-export",
  "officeLayoutDocument.ts",
);
const SOURCE_IMPORT_PATTERN =
  /\bimport\s*(?:type\s*)?(?:[^"'`]*?\sfrom\s*)?["']([^"']+)["']|\bexport\s+[^"'`]*?\sfrom\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
const OLD_SESSION_PERSISTENCE_FILES = [
  path.join(SRC_ROOT, "game", "session", "office-layout", "officeLayoutApi.ts"),
  path.join(
    SRC_ROOT,
    "game",
    "session",
    "office-layout",
    "officeLayoutContracts.ts",
  ),
  path.join(
    SRC_ROOT,
    "game",
    "session",
    "office-layout",
    "officeLayoutDocument.ts",
  ),
  path.join(SRC_ROOT, "game", "session", "office-layout", "frontendConfig.ts"),
  path.join(
    SRC_ROOT,
    "game",
    "session",
    "office-layout",
    "frontendTelemetry.ts",
  ),
];

function collectSourceFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") {
        continue;
      }

      files.push(...collectSourceFiles(entryPath));
      continue;
    }

    if (
      entry.isFile() &&
      SOURCE_FILE_EXTENSIONS.has(path.extname(entry.name))
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

function listImportSpecifiers(sourceText: string): string[] {
  const specifiers: string[] = [];

  for (const match of sourceText.matchAll(SOURCE_IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

function stripKnownSourceExtension(filePath: string): string {
  return filePath.replace(/\.(?:cts|mts|ts|tsx|js|jsx)$/, "");
}

describe("office layout data boundary", () => {
  test("stage 20 expands the data surface and removes app-level owners from src/data", () => {
    const dataIndexSource = fs.readFileSync(
      path.join(DATA_ROOT, "index.ts"),
      "utf8",
    );

    expect(fs.existsSync(path.join(DATA_ROOT, "contracts", "index.ts"))).toBe(
      true,
    );
    expect(fs.existsSync(DATA_STRUCTURES_ROOT)).toBe(true);
    expect(fs.existsSync(path.join(DATA_ROOT, "terrain", "index.ts"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(DATA_ROOT, "world-seeds", "index.ts"))).toBe(
      true,
    );
    expect(dataIndexSource).toContain('export * from "./contracts"');
    expect(dataIndexSource).toContain('export * from "./shared"');
    expect(dataIndexSource).toContain('export * from "./structures"');
    expect(dataIndexSource).toContain('export * from "./terrain"');
    expect(dataIndexSource).toContain('export * from "./world-seeds"');
    expect(fs.existsSync(OLD_DATA_OFFICE_LAYOUT_ROOT)).toBe(false);
    expect(fs.existsSync(OLD_DATA_FRONTEND_CONFIG_PATH)).toBe(false);
    expect(fs.existsSync(OLD_DATA_TELEMETRY_PATH)).toBe(false);
    expect(fs.existsSync(path.join(CONFIG_ROOT, "frontendConfig.ts"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(TELEMETRY_ROOT, "frontendTelemetry.ts")),
    ).toBe(true);
  });

  test("owns the Vite development route inside data and data-dev only", () => {
    const rootsToScan = [
      ...collectSourceFiles(SRC_ROOT),
      DATA_DEV_ADAPTER_PATH,
      path.join(FRONTEND_ROOT, "vite.config.ts"),
    ];
    const violations = rootsToScan
      .filter(
        (filePath) =>
          filePath !==
          path.join(DATA_OFFICE_LAYOUT_ROOT, "officeLayoutContracts.ts"),
      )
      .filter((filePath) =>
        fs.readFileSync(filePath, "utf8").includes(OFFICE_LAYOUT_DEV_ROUTE),
      )
      .map((filePath) => path.relative(FRONTEND_ROOT, filePath));

    expect(violations).toEqual([]);
  });

  test("limits office layout route constant usage to data, data-dev, and tests", () => {
    const rootsToScan = [
      ...collectSourceFiles(SRC_ROOT),
      DATA_DEV_ADAPTER_PATH,
      path.join(FRONTEND_ROOT, "vite.config.ts"),
    ];
    const violations = rootsToScan
      .filter(
        (filePath) =>
          filePath !== DATA_DEV_ADAPTER_PATH &&
          !filePath.startsWith(`${DATA_OFFICE_LAYOUT_ROOT}${path.sep}`),
      )
      .filter((filePath) =>
        fs.readFileSync(filePath, "utf8").includes("OFFICE_LAYOUT_DEV_ROUTE"),
      )
      .map((filePath) => path.relative(FRONTEND_ROOT, filePath));

    expect(violations).toEqual([]);
  });

  test("keeps ui isolated from src/data", () => {
    const dataRoot = stripKnownSourceExtension(DATA_ROOT);
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(UI_ROOT)) {
      const sourceText = fs.readFileSync(filePath, "utf8");

      for (const specifier of listImportSpecifiers(sourceText)) {
        if (!specifier.startsWith(".")) {
          continue;
        }

        const resolvedPath = stripKnownSourceExtension(
          path.resolve(path.dirname(filePath), specifier),
        );

        if (
          resolvedPath === dataRoot ||
          resolvedPath.startsWith(`${dataRoot}${path.sep}`)
        ) {
          violations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("keeps document translation under game/content after the data cleanup", () => {
    const documentImportSource = fs.readFileSync(
      GAME_DOCUMENT_IMPORT_OWNER_PATH,
      "utf8",
    );
    const documentExportSource = fs.readFileSync(
      GAME_DOCUMENT_EXPORT_OWNER_PATH,
      "utf8",
    );

    expect(fs.existsSync(GAME_DOCUMENT_IMPORT_OWNER_PATH)).toBe(true);
    expect(fs.existsSync(GAME_DOCUMENT_EXPORT_OWNER_PATH)).toBe(true);
    expect(documentImportSource).toContain("parseOfficeLayout");
    expect(documentImportSource).toContain("../../../data");
    expect(documentExportSource).toContain("formatOfficeLayout");
    expect(documentExportSource).toContain("syncFromRuntimeLayout");
    expect(documentExportSource).toContain("../../../data");
  });

  test("routes office editor persistence through game/application and removes old session owners", () => {
    const dataRoot = stripKnownSourceExtension(DATA_ROOT);
    const gameRoot = stripKnownSourceExtension(GAME_ROOT);
    const serviceImports = listImportSpecifiers(
      fs.readFileSync(GAME_EDITOR_SERVICE_PATH, "utf8"),
    )
      .filter((specifier) => specifier.startsWith("."))
      .map((specifier) =>
        stripKnownSourceExtension(
          path.resolve(path.dirname(GAME_EDITOR_SERVICE_PATH), specifier),
        ),
      );
    const hookImports = listImportSpecifiers(
      fs.readFileSync(UI_EDITOR_HOOK_PATH, "utf8"),
    )
      .filter((specifier) => specifier.startsWith("."))
      .map((specifier) =>
        stripKnownSourceExtension(
          path.resolve(path.dirname(UI_EDITOR_HOOK_PATH), specifier),
        ),
      );

    expect(
      serviceImports.some(
        (resolvedPath) =>
          resolvedPath === dataRoot ||
          resolvedPath.startsWith(`${dataRoot}${path.sep}`),
      ),
    ).toBe(true);
    expect(
      hookImports.some(
        (resolvedPath) =>
          resolvedPath === dataRoot ||
          resolvedPath.startsWith(`${dataRoot}${path.sep}`),
      ),
    ).toBe(false);
    expect(
      hookImports.some(
        (resolvedPath) =>
          resolvedPath === gameRoot ||
          resolvedPath.startsWith(`${gameRoot}${path.sep}`),
      ),
    ).toBe(true);
    expect(fs.existsSync(UI_EDITOR_HOOK_PATH)).toBe(true);
    expect(fs.existsSync(GAME_EDITOR_SERVICE_PATH)).toBe(true);
    expect(fs.existsSync(OLD_SESSION_EDITOR_PATH)).toBe(false);
    expect(
      OLD_SESSION_PERSISTENCE_FILES.filter((filePath) =>
        fs.existsSync(filePath),
      ),
    ).toEqual([]);
    expect(
      fs.existsSync(path.join(FRONTEND_ROOT, "officeLayoutDevAdapter.ts")),
    ).toBe(false);
    expect(
      fs.existsSync(
        path.join(FRONTEND_ROOT, "data-dev", "officeLayoutDevAdapter.ts"),
      ),
    ).toBe(false);
    expect(fs.existsSync(DATA_DEV_ADAPTER_PATH)).toBe(true);
  });
});

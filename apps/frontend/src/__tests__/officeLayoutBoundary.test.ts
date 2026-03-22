import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { OFFICE_LAYOUT_DEV_ROUTE } from "../app/officeLayoutContracts";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(TEST_DIR, "../..");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");
const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx"]);
const ALLOWED_ROUTE_LITERAL_FILES = new Set([
  path.join(SRC_ROOT, "app", "officeLayoutContracts.ts"),
]);
const OFFICE_LAYOUT_CONTRACT_BOUNDARY_FILES = [
  path.join(SRC_ROOT, "app", "useOfficeLayoutEditor.ts"),
  path.join(SRC_ROOT, "game", "protocol.ts"),
  path.join(SRC_ROOT, "game", "application", "runtimeGateway.ts"),
  path.join(SRC_ROOT, "game", "application", "useRuntimeUiBridge.ts"),
  path.join(SRC_ROOT, "game", "application", "runtimeUiBridgeHooks.ts"),
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

    if (entry.isFile() && SOURCE_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

describe("office layout route boundary", () => {
  test("keeps the Vite development route out of UI and runtime logic", () => {
    const rootsToScan = [
      ...collectSourceFiles(SRC_ROOT),
      path.join(FRONTEND_ROOT, "officeLayoutDevAdapter.ts"),
      path.join(FRONTEND_ROOT, "vite.config.ts"),
    ];
    const violations = rootsToScan
      .filter((filePath) => !ALLOWED_ROUTE_LITERAL_FILES.has(filePath))
      .filter((filePath) => fs.readFileSync(filePath, "utf8").includes(OFFICE_LAYOUT_DEV_ROUTE))
      .map((filePath) => path.relative(FRONTEND_ROOT, filePath));

    expect(violations).toEqual([]);
  });

  test("routes office layout editor and bridge types through the app contract", () => {
    const violations = OFFICE_LAYOUT_CONTRACT_BOUNDARY_FILES
      .filter((filePath) => fs.readFileSync(filePath, "utf8").includes("scenes/office/bootstrap"))
      .map((filePath) => path.relative(FRONTEND_ROOT, filePath));

    expect(violations).toEqual([]);
  });
});

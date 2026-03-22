import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(TEST_DIR, "..");
const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx"]);
const FORBIDDEN_IMPORT_PATTERN = /\bfrom\s+["']phaser["']/;
const FORBIDDEN_RUNTIME_ACCESS_PATTERN = /\bgame(?:Ref\.current)?\.events\b/;
const FORBIDDEN_PREVIEW_SCENE_IMPORT_PATTERN = /\bPreviewScene\b/;
const GATEWAY_ENTRYPOINTS = new Set([
  path.join(SRC_ROOT, "game", "application", "runtimeGateway.ts"),
]);

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

describe("runtime integration boundaries", () => {
  test("only gateway entrypoints may import Phaser or wire preview/runtime events directly", () => {
    const rootsToScan = [
      path.join(SRC_ROOT, "app"),
      path.join(SRC_ROOT, "components"),
      path.join(SRC_ROOT, "App.tsx"),
      path.join(SRC_ROOT, "game", "application"),
    ];
    const violations: string[] = [];

    for (const root of rootsToScan) {
      const filePaths = fs.statSync(root).isDirectory() ? collectSourceFiles(root) : [root];

      for (const filePath of filePaths) {
        if (GATEWAY_ENTRYPOINTS.has(filePath)) {
          continue;
        }

        const sourceText = fs.readFileSync(filePath, "utf8");
        if (
          FORBIDDEN_IMPORT_PATTERN.test(sourceText) ||
          FORBIDDEN_RUNTIME_ACCESS_PATTERN.test(sourceText) ||
          FORBIDDEN_PREVIEW_SCENE_IMPORT_PATTERN.test(sourceText)
        ) {
          violations.push(path.relative(SRC_ROOT, filePath));
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

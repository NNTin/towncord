import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(TEST_DIR, "..");
const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx"]);
const FORBIDDEN_IMPORT_PATTERN = /\bfrom\s+["']phaser["']/;
const FORBIDDEN_RUNTIME_ACCESS_PATTERN = /\bgame(?:Ref\.current)?\.events\b/;

function collectSourceFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
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
  test("React UI code outside the integration layer does not import Phaser or touch game.events", () => {
    const rootsToScan = [
      path.join(SRC_ROOT, "app"),
      path.join(SRC_ROOT, "components"),
      path.join(SRC_ROOT, "App.tsx"),
    ];
    const violations: string[] = [];

    for (const root of rootsToScan) {
      const filePaths = fs.statSync(root).isDirectory() ? collectSourceFiles(root) : [root];

      for (const filePath of filePaths) {
        const sourceText = fs.readFileSync(filePath, "utf8");
        if (
          FORBIDDEN_IMPORT_PATTERN.test(sourceText) ||
          FORBIDDEN_RUNTIME_ACCESS_PATTERN.test(sourceText)
        ) {
          violations.push(path.relative(SRC_ROOT, filePath));
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

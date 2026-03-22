import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(TEST_DIR, "..");
const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx"]);
const LEGACY_ARCHITECTURE_PATTERNS = [
  /\buseBloomseedUiBridge\b/,
  /\bbloomseedUiBridgeHooks\b/,
  /\bbloomseedRuntimeGateway\b/,
  /\bsyncFromPhaser\b/,
  /\bBloomseedUiBootstrap\b/,
  /\bBLOOMSEED_READY(?:_EVENT)?\b/,
  /\bBLOOMSEED_WORLD_BOOTSTRAP_REGISTRY_KEY\b/,
  /\bgetBloomseedWorldBootstrap\b/,
  /\bcomposeBloomseedBootstrap\b/,
  /\bPLACE_OBJECT_DROP(?:_EVENT)?\b/,
  /\bPlaceObjectDropPayload\b/,
  /\bnormalizePlaceObjectDropPayload\b/,
];

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

describe("architecture cutover boundary", () => {
  test("removes legacy bridge and protocol seam names from source", () => {
    const violations = collectSourceFiles(SRC_ROOT)
      .filter((filePath) => path.basename(filePath) !== "architectureCutoverBoundary.test.ts")
      .filter((filePath) => {
        const sourceText = fs.readFileSync(filePath, "utf8");
        return LEGACY_ARCHITECTURE_PATTERNS.some((pattern) => pattern.test(sourceText));
      })
      .map((filePath) => path.relative(SRC_ROOT, filePath));

    expect(violations).toEqual([]);
  });
});

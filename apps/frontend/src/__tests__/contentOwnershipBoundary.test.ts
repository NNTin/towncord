import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(TEST_DIR, "..");
const GAME_ROOT = path.join(SRC_ROOT, "game");
const CONTENT_ROOT = path.join(GAME_ROOT, "content");
const CONTENT_ASSET_CATALOG_ROOT = path.join(CONTENT_ROOT, "asset-catalog");
const CONTENT_CONTRACT_PATH = path.join(GAME_ROOT, "contracts", "content.ts");
const RETIRED_TERRAIN_DATA_ROOT = path.join(GAME_ROOT, "terrain", "data");
const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx"]);
const IMPORT_SPECIFIER_PATTERN =
  /\bimport\s*(?:type\s*)?(?:[^"'`]*?\sfrom\s*)?["']([^"']+)["']|\bexport\s+[^"'`]*?\sfrom\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;

function collectSourceFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(entryPath));
      continue;
    }

    if (
      entry.isFile() &&
      SOURCE_FILE_EXTENSIONS.has(path.extname(entry.name)) &&
      !entry.name.endsWith(".d.ts") &&
      !entry.name.includes(".test.")
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

function listImportSpecifiers(sourceText: string): string[] {
  const specifiers: string[] = [];

  for (const match of sourceText.matchAll(IMPORT_SPECIFIER_PATTERN)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

function isWithin(pathToCheck: string, root: string): boolean {
  const relative = path.relative(root, pathToCheck);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

describe("content ownership boundary", () => {
  test("production source does not import from the retired game/assets owner", () => {
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(SRC_ROOT)) {
      const sourceText = fs.readFileSync(filePath, "utf8");
      for (const specifier of listImportSpecifiers(sourceText)) {
        if (!specifier.startsWith(".")) {
          continue;
        }

        const resolvedPath = path.resolve(path.dirname(filePath), specifier);
        if (isWithin(resolvedPath, path.join(GAME_ROOT, "assets"))) {
          violations.push(`${path.relative(SRC_ROOT, filePath)} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("only game/content/asset-catalog imports public-assets-json virtual modules", () => {
    const violations = collectSourceFiles(SRC_ROOT)
      .filter((filePath) => !isWithin(filePath, CONTENT_ASSET_CATALOG_ROOT))
      .filter((filePath) => fs.readFileSync(filePath, "utf8").includes("public-assets-json:"))
      .map((filePath) => path.relative(SRC_ROOT, filePath));

    expect(violations).toEqual([]);
  });

  test("production source does not import from the retired terrain fixture owner", () => {
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(SRC_ROOT)) {
      const sourceText = fs.readFileSync(filePath, "utf8");
      for (const specifier of listImportSpecifiers(sourceText)) {
        if (!specifier.startsWith(".")) {
          continue;
        }

        const resolvedPath = path.resolve(path.dirname(filePath), specifier);
        if (isWithin(resolvedPath, RETIRED_TERRAIN_DATA_ROOT)) {
          violations.push(`${path.relative(SRC_ROOT, filePath)} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("only the asset-catalog owner imports terrain public asset modules", () => {
    const violations = collectSourceFiles(SRC_ROOT)
      .filter((filePath) => !isWithin(filePath, CONTENT_ASSET_CATALOG_ROOT))
      .filter((filePath) =>
        fs.readFileSync(filePath, "utf8").includes("public-assets-json:terrain/"),
      )
      .map((filePath) => path.relative(SRC_ROOT, filePath));

    expect(violations).toEqual([]);
  });

  test("game/contracts/content.ts no longer re-exports from game/assets", () => {
    const sourceText = fs.readFileSync(CONTENT_CONTRACT_PATH, "utf8");
    expect(sourceText).not.toContain("../assets/");
  });
});

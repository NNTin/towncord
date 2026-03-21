import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(TEST_DIR, "..");
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

    if (entry.isFile() && SOURCE_FILE_EXTENSIONS.has(path.extname(entry.name))) {
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

describe("frontend asset import boundaries", () => {
  test("src does not reach into workspace packages via filesystem imports", () => {
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(SRC_ROOT)) {
      const sourceText = fs.readFileSync(filePath, "utf8");
      for (const specifier of listImportSpecifiers(sourceText)) {
        if (!specifier.startsWith(".")) {
          if (specifier.startsWith("packages/") || specifier.includes("/packages/")) {
            violations.push(`${path.relative(SRC_ROOT, filePath)} -> ${specifier}`);
          }
          continue;
        }

        const resolvedPath = path.resolve(path.dirname(filePath), specifier);
        if (resolvedPath.includes(`${path.sep}packages${path.sep}`)) {
          violations.push(`${path.relative(SRC_ROOT, filePath)} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

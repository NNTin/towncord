import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(TEST_DIR, "../..");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");
const DATA_ROOT = path.join(SRC_ROOT, "data");
const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx"]);
const IMPORT_SPECIFIER_PATTERN =
  /\bimport\s*(?:type\s*)?(?:[^"'`]*?\sfrom\s*)?["']([^"']+)["']|\bexport\s+[^"'`]*?\sfrom\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;

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

function stripKnownSourceExtension(filePath: string): string {
  return filePath.replace(/\.(?:cts|mts|ts|tsx|js|jsx)$/, "");
}

describe("data ownership boundary", () => {
  test("keeps src/data isolated from ui, session, runtime, and dev-only modules", () => {
    const configRoot = stripKnownSourceExtension(path.join(SRC_ROOT, "config"));
    const uiRoot = stripKnownSourceExtension(path.join(SRC_ROOT, "ui"));
    const telemetryRoot = stripKnownSourceExtension(path.join(SRC_ROOT, "telemetry"));
    const gameSessionRoot = stripKnownSourceExtension(path.join(SRC_ROOT, "game", "session"));
    const gameApplicationRoot = stripKnownSourceExtension(
      path.join(SRC_ROOT, "game", "application"),
    );
    const gameRuntimeRoot = stripKnownSourceExtension(path.join(SRC_ROOT, "game", "runtime"));
    const gameScenesRoot = stripKnownSourceExtension(path.join(SRC_ROOT, "game", "scenes"));
    const dataDevRoot = stripKnownSourceExtension(path.join(FRONTEND_ROOT, "data-dev"));
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(DATA_ROOT)) {
      const sourceText = fs.readFileSync(filePath, "utf8");

      for (const specifier of listImportSpecifiers(sourceText)) {
        if (!specifier.startsWith(".")) {
          continue;
        }

        const resolvedPath = stripKnownSourceExtension(
          path.resolve(path.dirname(filePath), specifier),
        );

        if (
          resolvedPath === configRoot ||
          resolvedPath.startsWith(`${configRoot}${path.sep}`) ||
          resolvedPath === uiRoot ||
          resolvedPath.startsWith(`${uiRoot}${path.sep}`) ||
          resolvedPath === telemetryRoot ||
          resolvedPath.startsWith(`${telemetryRoot}${path.sep}`) ||
          resolvedPath === gameSessionRoot ||
          resolvedPath.startsWith(`${gameSessionRoot}${path.sep}`) ||
          resolvedPath === gameRuntimeRoot ||
          resolvedPath.startsWith(`${gameRuntimeRoot}${path.sep}`) ||
          resolvedPath === gameApplicationRoot ||
          resolvedPath.startsWith(`${gameApplicationRoot}${path.sep}`) ||
          resolvedPath === gameScenesRoot ||
          resolvedPath.startsWith(`${gameScenesRoot}${path.sep}`) ||
          resolvedPath === dataDevRoot ||
          resolvedPath.startsWith(`${dataDevRoot}${path.sep}`)
        ) {
          violations.push(`${path.relative(SRC_ROOT, filePath)} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

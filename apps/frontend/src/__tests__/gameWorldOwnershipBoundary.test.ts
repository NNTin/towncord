import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(TEST_DIR, "..");
const FRONTEND_ROOT = path.resolve(SRC_ROOT, "..");
const GAME_ROOT = path.join(SRC_ROOT, "game");
const WORLD_ROOT = path.join(GAME_ROOT, "world");
const WORLD_ENTITIES_ROOT = path.join(WORLD_ROOT, "entities");
const WORLD_STRUCTURES_ROOT = path.join(WORLD_ROOT, "structures");
const CONTENT_STRUCTURES_ROOT = path.join(GAME_ROOT, "content", "structures");
const DOMAIN_ROOT = path.join(GAME_ROOT, "domain");
const OFFICE_ROOT = path.join(GAME_ROOT, "office");
const UI_ROOT = path.join(SRC_ROOT, "ui");
const DATA_ROOT = path.join(SRC_ROOT, "data");
const PUBLIC_ASSETS_ROOT = path.join(FRONTEND_ROOT, "public", "assets");
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

describe("game world ownership boundary", () => {
  test("stage 18 creates world owners and removes the retired coarse owners", () => {
    expect(fs.existsSync(WORLD_ROOT)).toBe(true);
    expect(fs.existsSync(path.join(WORLD_ENTITIES_ROOT, "entityRegistry.ts"))).toBe(true);
    expect(fs.existsSync(path.join(WORLD_STRUCTURES_ROOT, "rules.ts"))).toBe(true);
    expect(fs.existsSync(path.join(CONTENT_STRUCTURES_ROOT, "colors.ts"))).toBe(true);
    expect(fs.existsSync(DOMAIN_ROOT)).toBe(false);
    expect(fs.existsSync(OFFICE_ROOT)).toBe(false);
  });

  test("production source no longer imports retired domain and office semantic owners", () => {
    const retiredOwners = [
      stripKnownSourceExtension(DOMAIN_ROOT),
      stripKnownSourceExtension(OFFICE_ROOT),
      stripKnownSourceExtension(path.join(OFFICE_ROOT, "model.ts")),
      stripKnownSourceExtension(path.join(OFFICE_ROOT, "rules.ts")),
    ];
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(SRC_ROOT)) {
      const sourceText = fs.readFileSync(filePath, "utf8");

      for (const specifier of listImportSpecifiers(sourceText)) {
        if (!specifier.startsWith(".")) {
          continue;
        }

        const resolvedPath = stripKnownSourceExtension(
          path.resolve(path.dirname(filePath), specifier),
        );

        if (
          retiredOwners.some(
            (retiredOwner) =>
              resolvedPath === retiredOwner ||
              resolvedPath.startsWith(`${retiredOwner}${path.sep}`),
          )
        ) {
          violations.push(`${path.relative(SRC_ROOT, filePath)} -> ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("production seams read entity and structure semantics from game/world", () => {
    const runtimeCompilationSource = fs.readFileSync(
      path.join(
        GAME_ROOT,
        "application",
        "runtime-compilation",
        "load-plans",
        "runtimeBootstrap.ts",
      ),
      "utf8",
    );
    const entityRegistryBuilderSource = fs.readFileSync(
      path.join(GAME_ROOT, "application", "entityRegistryBuilder.ts"),
      "utf8",
    );
    const officeEditorSystemSource = fs.readFileSync(
      path.join(GAME_ROOT, "runtime", "world", "officeEditorSystem.ts"),
      "utf8",
    );

    expect(runtimeCompilationSource).toContain("../../../world/entities/entityRegistry");
    expect(entityRegistryBuilderSource).toContain("../world/entities/archetypes");
    expect(entityRegistryBuilderSource).toContain("../world/entities/entityRegistry");
    expect(officeEditorSystemSource).toContain("../../world/structures/model");
  });

  test("world owners do not import React, Phaser, ui, data, or generated assets", () => {
    const worldRoots = [WORLD_ENTITIES_ROOT, WORLD_STRUCTURES_ROOT];
    const forbiddenRoots = [
      stripKnownSourceExtension(UI_ROOT),
      stripKnownSourceExtension(DATA_ROOT),
      stripKnownSourceExtension(PUBLIC_ASSETS_ROOT),
    ];
    const violations: string[] = [];

    for (const worldRoot of worldRoots) {
      for (const filePath of collectSourceFiles(worldRoot)) {
        const sourceText = fs.readFileSync(filePath, "utf8");

        if (sourceText.includes('from "react"') || sourceText.includes("from 'react'")) {
          violations.push(path.relative(SRC_ROOT, filePath));
          continue;
        }

        if (sourceText.includes('from "phaser"') || sourceText.includes("from 'phaser'")) {
          violations.push(path.relative(SRC_ROOT, filePath));
          continue;
        }

        for (const specifier of listImportSpecifiers(sourceText)) {
          if (!specifier.startsWith(".")) {
            continue;
          }

          const resolvedPath = stripKnownSourceExtension(
            path.resolve(path.dirname(filePath), specifier),
          );

          if (
            forbiddenRoots.some(
              (forbiddenRoot) =>
                resolvedPath === forbiddenRoot ||
                resolvedPath.startsWith(`${forbiddenRoot}${path.sep}`),
            )
          ) {
            violations.push(`${path.relative(SRC_ROOT, filePath)} -> ${specifier}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(TEST_DIR, "../..");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");
const GAME_ROOT = path.join(SRC_ROOT, "game");
const CONTRACTS_ROOT = path.join(GAME_ROOT, "contracts");
const OFFICE_SCENE_CONTRACT_PATH = path.join(CONTRACTS_ROOT, "office-scene.ts");
const RUNTIME_CONTRACT_PATH = path.join(CONTRACTS_ROOT, "runtime.ts");
const OFFICE_EDITOR_CONTRACT_PATH = path.join(
  CONTRACTS_ROOT,
  "office-editor.ts",
);
const PREVIEW_CONTRACT_PATH = path.join(CONTRACTS_ROOT, "preview.ts");
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

describe("public game surface boundary", () => {
  test("stage 14 removes the mixed session contract owner and exports explicit contract owners", () => {
    const sourceText = fs.readFileSync(
      path.join(CONTRACTS_ROOT, "index.ts"),
      "utf8",
    );

    expect(fs.existsSync(path.join(CONTRACTS_ROOT, "session.ts"))).toBe(false);
    expect(fs.existsSync(RUNTIME_CONTRACT_PATH)).toBe(true);
    expect(fs.existsSync(OFFICE_EDITOR_CONTRACT_PATH)).toBe(true);
    expect(fs.existsSync(OFFICE_SCENE_CONTRACT_PATH)).toBe(true);
    expect(fs.existsSync(PREVIEW_CONTRACT_PATH)).toBe(true);
    expect(sourceText).toContain('export * from "./runtime"');
    expect(sourceText).toContain('export * from "./office-editor"');
    expect(sourceText).toContain('export * from "./preview"');
    expect(sourceText).toContain('from "./office-scene"');
    expect(sourceText).not.toContain("./session");
  });

  test("game index re-exports public application, projection, and document seams without React session hooks", () => {
    const sourceText = fs.readFileSync(
      path.join(GAME_ROOT, "index.ts"),
      "utf8",
    );
    const exportSpecifiers = listImportSpecifiers(sourceText).filter(
      (specifier) => specifier.startsWith("."),
    );

    expect(exportSpecifiers).toEqual([
      "./application/command-handlers/officeEditorToolPayload",
      "./application/command-handlers/placeDragPayload",
      "./application/use-cases/officeLayoutEditorService",
      "./application/use-cases/terrainSeedEditorService",
      "./application/use-cases/previewRuntimeBridge",
      "./application/projections/runtimeSidebarProjection",
      "./application/transactions/runtimeBridgeState",
      "./content/document-import",
      "./content/document-export",
      "./contracts/office-scene",
      "./session",
      "./session",
    ]);
    expect(sourceText).not.toContain("useGameSession");
    expect(sourceText).not.toContain("usePreviewRuntime");
  });

  test("stage 22 creates concrete application owners for command handlers, use cases, transactions, and projections", () => {
    expect(
      fs.existsSync(
        path.join(
          GAME_ROOT,
          "application",
          "command-handlers",
          "officeEditorToolPayload.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          GAME_ROOT,
          "application",
          "command-handlers",
          "placeDragPayload.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          GAME_ROOT,
          "application",
          "use-cases",
          "officeLayoutEditorService.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          GAME_ROOT,
          "application",
          "use-cases",
          "previewRuntimeBridge.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          GAME_ROOT,
          "application",
          "transactions",
          "runtimeBridgeState.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          GAME_ROOT,
          "application",
          "projections",
          "runtimeSidebarProjection.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          SRC_ROOT,
          "ui",
          "game-session",
          "view-models",
          "runtimeBridgeState.ts",
        ),
      ),
    ).toBe(false);
  });

  test("keeps React session hooks in ui while restoring a production game session owner", () => {
    expect(fs.existsSync(path.join(CONTRACTS_ROOT, "ui.ts"))).toBe(false);
    expect(fs.existsSync(path.join(GAME_ROOT, "session", "index.ts"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(GAME_ROOT, "session", "GameSession.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(GAME_ROOT, "session", "PreviewSession.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          GAME_ROOT,
          "session",
          "runtime",
          "createMountedGameSession.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          GAME_ROOT,
          "session",
          "preview",
          "createMountedPreviewSession.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(SRC_ROOT, "ui", "game-session", "hooks", "useGameSession.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          SRC_ROOT,
          "ui",
          "game-session",
          "hooks",
          "usePreviewRuntime.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          SRC_ROOT,
          "ui",
          "editors",
          "office-layout",
          "draft-state",
          "useOfficeLayoutEditor.ts",
        ),
      ),
    ).toBe(true);
  });

  test("game session owner files do not import React", () => {
    const reactImportPattern = /from\s+["']react["']/;
    const sessionRoot = path.join(GAME_ROOT, "session");
    const violations = collectSourceFiles(sessionRoot)
      .filter((filePath) =>
        reactImportPattern.test(fs.readFileSync(filePath, "utf8")),
      )
      .map((filePath) => path.relative(SRC_ROOT, filePath));

    expect(violations).toEqual([]);
  });

  test("session factories compose runtime assembly and session owners without runtime gateways", () => {
    const gameFactorySource = fs.readFileSync(
      path.join(GAME_ROOT, "session", "GameSessionFactory.ts"),
      "utf8",
    );
    const previewFactorySource = fs.readFileSync(
      path.join(GAME_ROOT, "session", "PreviewSessionFactory.ts"),
      "utf8",
    );
    const runtimeIndexSource = fs.readFileSync(
      path.join(GAME_ROOT, "runtime", "index.ts"),
      "utf8",
    );

    expect(gameFactorySource).toContain(
      "../runtime/assembly/createWorldRuntimeHostAssembly",
    );
    expect(gameFactorySource).toContain("./runtime/createMountedGameSession");
    expect(gameFactorySource).not.toContain("runtime/gateway");
    expect(previewFactorySource).toContain(
      "../runtime/assembly/createPreviewRuntimeHostAssembly",
    );
    expect(previewFactorySource).toContain(
      "./preview/createMountedPreviewSession",
    );
    expect(previewFactorySource).not.toContain("runtime/gateway");
    expect(runtimeIndexSource).not.toContain("runtimeGateway");
    expect(runtimeIndexSource).not.toContain("previewRuntimeGateway");
  });

  test("ui runtime hooks consume mounted-session seams from the public game session owner", () => {
    const runtimeUiBridgeHookFile = path.join(
      SRC_ROOT,
      "ui",
      "game-session",
      "hooks",
      "runtimeUiBridgeHooks.ts",
    );
    const previewRuntimeHookFile = path.join(
      SRC_ROOT,
      "ui",
      "game-session",
      "hooks",
      "usePreviewRuntime.ts",
    );
    const sessionRoot = stripKnownSourceExtension(path.join(GAME_ROOT, "session"));

    expect(fs.existsSync(path.join(GAME_ROOT, "session.ts"))).toBe(true);

    for (const filePath of [runtimeUiBridgeHookFile, previewRuntimeHookFile]) {
      const importTargets = listImportSpecifiers(fs.readFileSync(filePath, "utf8"))
        .filter((specifier) => specifier.startsWith("."))
        .map((specifier) =>
          stripKnownSourceExtension(
            path.resolve(path.dirname(filePath), specifier),
          ),
        );

      expect(importTargets).toContain(sessionRoot);
      expect(
        importTargets.some(
          (importTarget) =>
            importTarget.startsWith(`${sessionRoot}${path.sep}`),
        ),
      ).toBe(false);
    }
  });

  test("production game files do not import React after the Stage 10 cutover", () => {
    const reactImportPattern = /from\s+["']react["']/;
    const violations = collectSourceFiles(GAME_ROOT)
      .filter((filePath) =>
        reactImportPattern.test(fs.readFileSync(filePath, "utf8")),
      )
      .map((filePath) => path.relative(SRC_ROOT, filePath));

    expect(violations).toEqual([]);
  });

  test("stage 14 contracts stay narrow and do not leak OfficeLayoutDocument or UI-local view models", () => {
    const runtimeSource = fs.readFileSync(RUNTIME_CONTRACT_PATH, "utf8");
    const officeEditorSource = fs.readFileSync(
      OFFICE_EDITOR_CONTRACT_PATH,
      "utf8",
    );
    const previewSource = fs.readFileSync(PREVIEW_CONTRACT_PATH, "utf8");

    for (const sourceText of [
      runtimeSource,
      officeEditorSource,
      previewSource,
    ]) {
      expect(sourceText).not.toContain('from "react"');
      expect(sourceText).not.toContain("RuntimeRootBindings");
      expect(sourceText).not.toContain("PlaceablesPanelViewModel");
      expect(sourceText).not.toContain("PreviewPanelViewModel");
      expect(sourceText).not.toContain("SidebarViewModel");
      expect(sourceText).not.toContain("ZoomControlsViewModel");
      expect(sourceText).not.toContain("OfficeLayoutDocument");
    }
  });

  test("production source files do not import the retired session contract owner", () => {
    const sessionRoot = stripKnownSourceExtension(
      path.join(CONTRACTS_ROOT, "session.ts"),
    );
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

        if (resolvedPath === sessionRoot) {
          violations.push(path.relative(SRC_ROOT, filePath));
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("contracts do not depend on runtime transport, scenes, or dev adapters", () => {
    const runtimeRoot = stripKnownSourceExtension(
      path.join(GAME_ROOT, "runtime"),
    );
    const applicationRoot = stripKnownSourceExtension(
      path.join(GAME_ROOT, "application"),
    );
    const scenesRoot = stripKnownSourceExtension(
      path.join(GAME_ROOT, "scenes"),
    );
    const devAdapterPath = stripKnownSourceExtension(
      path.join(
        FRONTEND_ROOT,
        "data-dev",
        "structures",
        "office-layout",
        "officeLayoutDevAdapter.ts",
      ),
    );
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(CONTRACTS_ROOT)) {
      const sourceText = fs.readFileSync(filePath, "utf8");

      for (const specifier of listImportSpecifiers(sourceText)) {
        if (!specifier.startsWith(".")) {
          continue;
        }

        const resolvedPath = stripKnownSourceExtension(
          path.resolve(path.dirname(filePath), specifier),
        );

        if (
          resolvedPath === runtimeRoot ||
          resolvedPath.startsWith(`${runtimeRoot}${path.sep}`) ||
          resolvedPath === devAdapterPath ||
          resolvedPath.startsWith(`${applicationRoot}${path.sep}`) ||
          resolvedPath.startsWith(`${scenesRoot}${path.sep}`)
        ) {
          violations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

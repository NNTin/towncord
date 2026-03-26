import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(TEST_DIR, "..");
const UI_ROOT = path.join(SRC_ROOT, "ui");
const GAME_ROOT = path.join(SRC_ROOT, "game");
const ENGINE_ROOT = path.join(SRC_ROOT, "engine");
const CONFIG_ROOT = path.join(SRC_ROOT, "config");
const DATA_ROOT = path.join(SRC_ROOT, "data");
const RUNTIME_ROOT = path.join(GAME_ROOT, "runtime");
const TELEMETRY_ROOT = path.join(SRC_ROOT, "telemetry");
const UI_SESSION_ROOT = path.join(UI_ROOT, "game-session");
const UI_SESSION_HOOKS_ROOT = path.join(UI_SESSION_ROOT, "hooks");
const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx"]);
const IMPORT_SPECIFIER_PATTERN =
  /\bimport\s*(?:type\s*)?(?:[^"'`]*?\sfrom\s*)?["']([^"']+)["']|\bexport\s+[^"'`]*?\sfrom\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
const FORBIDDEN_RUNTIME_ACCESS_PATTERN =
  /\bgame(?:Ref(?:\?\.|\.)current)?(?:\?\.|\.)events\b/;
const FORBIDDEN_PREVIEW_SCENE_IMPORT_PATTERN = /\bPreviewScene\b/;
const FORBIDDEN_OFFICE_SCENE_CONTRACT_IMPORT_PATTERN =
  /officeLayoutSceneContract|scenes\/office\/bootstrap/;
const ALLOWED_WORLD_TRANSPORT_ADAPTERS = new Set([
  "worldSceneCommandBindings.ts",
  "worldSceneProjections.ts",
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

function isInsideDirectory(filePath: string, directoryPath: string): boolean {
  const relativePath = path.relative(directoryPath, filePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function isAllowedGameImportTarget(resolvedPath: string): boolean {
  const normalized = stripKnownSourceExtension(resolvedPath);
  const allowedRoots = new Set([
    stripKnownSourceExtension(GAME_ROOT),
    stripKnownSourceExtension(path.join(GAME_ROOT, "index")),
    stripKnownSourceExtension(path.join(GAME_ROOT, "contracts")),
    stripKnownSourceExtension(path.join(GAME_ROOT, "contracts", "index")),
    stripKnownSourceExtension(path.join(GAME_ROOT, "session")),
  ]);
  const deprecatedUiContract = stripKnownSourceExtension(
    path.join(GAME_ROOT, "contracts", "ui"),
  );

  if (normalized === deprecatedUiContract) {
    return false;
  }

  if (allowedRoots.has(normalized)) {
    return true;
  }

  const publicContractsRoot = stripKnownSourceExtension(
    path.join(GAME_ROOT, "contracts"),
  );
  return normalized.startsWith(`${publicContractsRoot}${path.sep}`);
}

describe("runtime integration boundaries", () => {
  test("runtime access guard catches direct and optional-chaining event access", () => {
    expect(
      FORBIDDEN_RUNTIME_ACCESS_PATTERN.test("game.events.emit('preview:play')"),
    ).toBe(true);
    expect(
      FORBIDDEN_RUNTIME_ACCESS_PATTERN.test(
        "game?.events.emit('preview:play')",
      ),
    ).toBe(true);
    expect(
      FORBIDDEN_RUNTIME_ACCESS_PATTERN.test(
        "gameRef.current.events.emit('preview:play')",
      ),
    ).toBe(true);
    expect(
      FORBIDDEN_RUNTIME_ACCESS_PATTERN.test(
        "gameRef.current?.events.emit('preview:play')",
      ),
    ).toBe(true);
    expect(
      FORBIDDEN_RUNTIME_ACCESS_PATTERN.test(
        "gameRef?.current?.events.emit('preview:play')",
      ),
    ).toBe(true);
    expect(
      FORBIDDEN_RUNTIME_ACCESS_PATTERN.test(
        "runtime.events.emit('preview:play')",
      ),
    ).toBe(false);
  });

  test("ui imports only approved game seams and not data, engine, scenes, or runtime transport", () => {
    const violations: string[] = [];
    const dataRoot = stripKnownSourceExtension(DATA_ROOT);
    const engineRoot = stripKnownSourceExtension(ENGINE_ROOT);
    const gameScenesRoot = stripKnownSourceExtension(
      path.join(GAME_ROOT, "scenes"),
    );
    const runtimeTransportRoot = stripKnownSourceExtension(
      path.join(RUNTIME_ROOT, "transport"),
    );

    for (const filePath of collectSourceFiles(UI_ROOT)) {
      const sourceText = fs.readFileSync(filePath, "utf8");

      for (const specifier of listImportSpecifiers(sourceText)) {
        if (specifier === "phaser") {
          violations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
          continue;
        }

        if (!specifier.startsWith(".")) {
          continue;
        }

        const resolvedPath = stripKnownSourceExtension(
          path.resolve(path.dirname(filePath), specifier),
        );
        if (
          resolvedPath === dataRoot ||
          resolvedPath.startsWith(`${dataRoot}${path.sep}`) ||
          resolvedPath === engineRoot ||
          resolvedPath.startsWith(`${engineRoot}${path.sep}`) ||
          resolvedPath === gameScenesRoot ||
          resolvedPath.startsWith(`${gameScenesRoot}${path.sep}`) ||
          resolvedPath === runtimeTransportRoot ||
          resolvedPath.startsWith(`${runtimeTransportRoot}${path.sep}`)
        ) {
          violations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
          continue;
        }

        if (
          isInsideDirectory(resolvedPath, GAME_ROOT) &&
          !isAllowedGameImportTarget(resolvedPath)
        ) {
          violations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("ui files do not import Phaser or wire preview/runtime events directly", () => {
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(UI_ROOT)) {
      const sourceText = fs.readFileSync(filePath, "utf8");
      if (
        sourceText.includes('from "phaser"') ||
        sourceText.includes("from 'phaser'") ||
        FORBIDDEN_RUNTIME_ACCESS_PATTERN.test(sourceText) ||
        FORBIDDEN_PREVIEW_SCENE_IMPORT_PATTERN.test(sourceText)
      ) {
        violations.push(path.relative(SRC_ROOT, filePath));
      }
    }

    expect(violations).toEqual([]);
  });

  test("ui and game import config and telemetry only through public seams", () => {
    const configPublicRoots = new Set([
      stripKnownSourceExtension(CONFIG_ROOT),
      stripKnownSourceExtension(path.join(CONFIG_ROOT, "index")),
    ]);
    const telemetryPublicRoots = new Set([
      stripKnownSourceExtension(TELEMETRY_ROOT),
      stripKnownSourceExtension(path.join(TELEMETRY_ROOT, "index")),
    ]);
    const violations: string[] = [];

    for (const root of [UI_ROOT, GAME_ROOT]) {
      for (const filePath of collectSourceFiles(root)) {
        for (const specifier of listImportSpecifiers(
          fs.readFileSync(filePath, "utf8"),
        )) {
          if (!specifier.startsWith(".")) {
            continue;
          }

          const resolvedPath = stripKnownSourceExtension(
            path.resolve(path.dirname(filePath), specifier),
          );

          if (
            isInsideDirectory(resolvedPath, CONFIG_ROOT) &&
            !configPublicRoots.has(resolvedPath)
          ) {
            violations.push(`${path.relative(SRC_ROOT, filePath)} -> ${specifier}`);
          }

          if (
            isInsideDirectory(resolvedPath, TELEMETRY_ROOT) &&
            !telemetryPublicRoots.has(resolvedPath)
          ) {
            violations.push(`${path.relative(SRC_ROOT, filePath)} -> ${specifier}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("ui session hooks use the public game session owner and avoid deleted seams", () => {
    const deletedTransportFiles = new Set([
      stripKnownSourceExtension(path.join(GAME_ROOT, "protocol.ts")),
      stripKnownSourceExtension(
        path.join(GAME_ROOT, "previewRuntimeContract.ts"),
      ),
      stripKnownSourceExtension(
        path.join(GAME_ROOT, "application", "runtimeGateway.ts"),
      ),
    ]);
    const sessionRoot = stripKnownSourceExtension(path.join(GAME_ROOT, "session"));
    const requiredRuntimeImportFiles = [
      path.join(UI_SESSION_HOOKS_ROOT, "runtimeUiBridgeHooks.ts"),
      path.join(UI_SESSION_HOOKS_ROOT, "usePreviewRuntime.ts"),
    ];
    const deletedSeamViolations: string[] = [];
    const missingSessionImports: string[] = [];
    const runtimeInternalViolations: string[] = [];
    const sessionInternalViolations: string[] = [];

    for (const filePath of collectSourceFiles(UI_SESSION_ROOT)) {
      const sourceText = fs.readFileSync(filePath, "utf8");

      for (const specifier of listImportSpecifiers(sourceText)) {
        if (!specifier.startsWith(".")) {
          continue;
        }

        const resolvedPath = stripKnownSourceExtension(
          path.resolve(path.dirname(filePath), specifier),
        );
        if (deletedTransportFiles.has(resolvedPath)) {
          deletedSeamViolations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
        }

        if (
          resolvedPath === stripKnownSourceExtension(RUNTIME_ROOT) ||
          resolvedPath.startsWith(
            `${stripKnownSourceExtension(RUNTIME_ROOT)}${path.sep}`,
          )
        ) {
          runtimeInternalViolations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
        }

        if (
          resolvedPath.startsWith(`${sessionRoot}${path.sep}`)
        ) {
          sessionInternalViolations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
        }
      }
    }

    for (const filePath of requiredRuntimeImportFiles) {
      const sessionImports = listImportSpecifiers(
        fs.readFileSync(filePath, "utf8"),
      )
        .filter((specifier) => specifier.startsWith("."))
        .map((specifier) =>
          stripKnownSourceExtension(
            path.resolve(path.dirname(filePath), specifier),
          ),
        )
        .filter((resolvedPath) => resolvedPath === sessionRoot);

      if (sessionImports.length === 0) {
        missingSessionImports.push(path.relative(SRC_ROOT, filePath));
      }
    }

    expect(fs.existsSync(path.join(GAME_ROOT, "session.ts"))).toBe(true);
    expect(deletedSeamViolations).toEqual([]);
    expect(runtimeInternalViolations).toEqual([]);
    expect(sessionInternalViolations).toEqual([]);
    expect(missingSessionImports).toEqual([]);
  });

  test("AppShell and AnimationPreview consume the UI-owned session hooks", () => {
    const appShellSource = fs.readFileSync(
      path.join(UI_ROOT, "app-shell", "AppShell.tsx"),
      "utf8",
    );
    const animationPreviewSource = fs.readFileSync(
      path.join(UI_ROOT, "sidebar", "preview", "AnimationPreview.tsx"),
      "utf8",
    );

    expect(appShellSource).toContain("../game-session/hooks/useGameSession");
    expect(appShellSource).not.toContain('from "../../game"');
    expect(animationPreviewSource).toContain(
      "../../game-session/hooks/usePreviewRuntime",
    );
    expect(animationPreviewSource).not.toContain('from "../../../game"');
  });

  test("worldSceneAssembly reads engine runtime seams from the engine public surface", () => {
    const assemblyFile = path.join(
      SRC_ROOT,
      "game",
      "runtime",
      "world",
      "worldSceneAssembly.ts",
    );
    const sourceText = fs.readFileSync(assemblyFile, "utf8");
    const importPaths = listImportSpecifiers(sourceText)
      .filter((specifier) => specifier.startsWith("."))
      .map((specifier) =>
        stripKnownSourceExtension(
          path.resolve(path.dirname(assemblyFile), specifier),
        ),
      );
    const enginePublicSurface = stripKnownSourceExtension(ENGINE_ROOT);

    expect(importPaths).toContain(enginePublicSurface);

    const deletedPrimitives = new Set([
      stripKnownSourceExtension(
        path.join(
          SRC_ROOT,
          "game",
          "scenes",
          "world",
          "worldSceneCameraController",
        ),
      ),
      stripKnownSourceExtension(
        path.join(SRC_ROOT, "game", "scenes", "world", "inputRouter"),
      ),
      stripKnownSourceExtension(
        path.join(
          SRC_ROOT,
          "game",
          "scenes",
          "world",
          "worldSceneDiagnosticsController",
        ),
      ),
    ]);

    for (const importPath of importPaths) {
      expect(deletedPrimitives.has(importPath)).toBe(false);
    }

    expect(sourceText).toContain("WorldRuntimeCameraController");
    expect(sourceText).toContain("WorldRuntimeInputRouter");
    expect(sourceText).toContain("WorldRuntimeDiagnosticsController");
    expect(sourceText).toContain("TerrainRuntime");
  });

  test("worldSceneOfficeRuntime reads structure runtime seams from the engine public surface", () => {
    const officeRuntimeFile = path.join(
      SRC_ROOT,
      "game",
      "runtime",
      "world",
      "worldSceneOfficeRuntime.ts",
    );
    const sourceText = fs.readFileSync(officeRuntimeFile, "utf8");
    const importPaths = listImportSpecifiers(sourceText)
      .filter((specifier) => specifier.startsWith("."))
      .map((specifier) =>
        stripKnownSourceExtension(
          path.resolve(path.dirname(officeRuntimeFile), specifier),
        ),
      );

    expect(importPaths).toContain(stripKnownSourceExtension(ENGINE_ROOT));
    expect(sourceText).toContain("renderOfficeLayout");
    expect(sourceText).toContain("WORLD_REGION_BASE_PX");
  });

  test("runtime lifecycle entrypoints do not import the retired game/scenes namespace", () => {
    const lifecycleFiles = [
      path.join(
        SRC_ROOT,
        "game",
        "runtime",
        "world",
        "createWorldSceneLifecycle.ts",
      ),
      path.join(
        SRC_ROOT,
        "game",
        "runtime",
        "preload",
        "createWorldRuntimePreloadLifecycle.ts",
      ),
    ];
    const retiredScenesRoot = stripKnownSourceExtension(
      path.join(GAME_ROOT, "scenes"),
    );
    const violations: string[] = [];

    for (const filePath of lifecycleFiles) {
      const importPaths = listImportSpecifiers(
        fs.readFileSync(filePath, "utf8"),
      )
        .filter((specifier) => specifier.startsWith("."))
        .map((specifier) =>
          stripKnownSourceExtension(
            path.resolve(path.dirname(filePath), specifier),
          ),
        );

      if (
        importPaths.some(
          (importPath) =>
            importPath === retiredScenesRoot ||
            importPath.startsWith(`${retiredScenesRoot}${path.sep}`),
        )
      ) {
        violations.push(path.relative(SRC_ROOT, filePath));
      }
    }

    expect(violations).toEqual([]);
  });

  test("world runtime assembly imports engine-owned scene lifecycle factories instead of deleted game scene shells", () => {
    const runtimeAssemblyFile = path.join(
      SRC_ROOT,
      "game",
      "runtime",
      "assembly",
      "createWorldRuntimeHostAssembly.ts",
    );
    const sceneRoot = path.join(ENGINE_ROOT, "world-runtime", "scene");
    const sourceText = fs.readFileSync(runtimeAssemblyFile, "utf8");
    const importPaths = listImportSpecifiers(sourceText)
      .filter((specifier) => specifier.startsWith("."))
      .map((specifier) =>
        stripKnownSourceExtension(
          path.resolve(path.dirname(runtimeAssemblyFile), specifier),
        ),
      );

    const deletedBootScene = stripKnownSourceExtension(
      path.join(GAME_ROOT, "scenes", "BootScene"),
    );
    const deletedWorldScene = stripKnownSourceExtension(
      path.join(GAME_ROOT, "scenes", "WorldScene"),
    );
    const engineSceneBarrel = stripKnownSourceExtension(
      path.join(sceneRoot, "runtimeScenes"),
    );

    expect(importPaths).not.toContain(deletedBootScene);
    expect(importPaths).not.toContain(deletedWorldScene);
    expect(importPaths).toContain(engineSceneBarrel);
    expect(sourceText).toContain("/scene/runtimeScenes");
    expect(sourceText).not.toContain("/scene/public");
    expect(sourceText).toContain("createBootRuntimeScene");
    expect(sourceText).toContain("createWorldRuntimeScene");
    expect(sourceText).toContain("createPreloadRuntimeScene");
  });

  test("world runtime assembly does not import deleted PreloadScene", () => {
    const runtimeAssemblyFile = path.join(
      SRC_ROOT,
      "game",
      "runtime",
      "assembly",
      "createWorldRuntimeHostAssembly.ts",
    );
    const sceneRoot = path.join(ENGINE_ROOT, "world-runtime", "scene");
    const sourceText = fs.readFileSync(runtimeAssemblyFile, "utf8");
    const importPaths = listImportSpecifiers(sourceText)
      .filter((specifier) => specifier.startsWith("."))
      .map((specifier) =>
        stripKnownSourceExtension(
          path.resolve(path.dirname(runtimeAssemblyFile), specifier),
        ),
      );

    const engineSceneBarrel = stripKnownSourceExtension(
      path.join(sceneRoot, "runtimeScenes"),
    );
    const deletedPreloadScene = stripKnownSourceExtension(
      path.join(GAME_ROOT, "scenes", "PreloadScene"),
    );

    expect(importPaths).toContain(engineSceneBarrel);
    expect(importPaths).not.toContain(deletedPreloadScene);
    expect(sourceText).toContain("/scene/runtimeScenes");
    expect(sourceText).not.toContain("/scene/public");
  });

  test("preview runtime assembly imports the engine preview scene factory and does not import deleted PreviewScene", () => {
    const previewAssemblyFile = path.join(
      SRC_ROOT,
      "game",
      "runtime",
      "assembly",
      "createPreviewRuntimeHostAssembly.ts",
    );
    const previewSceneRoot = path.join(ENGINE_ROOT, "preview-runtime", "scene");
    const sourceText = fs.readFileSync(previewAssemblyFile, "utf8");
    const importPaths = listImportSpecifiers(sourceText)
      .filter((specifier) => specifier.startsWith("."))
      .map((specifier) =>
        stripKnownSourceExtension(
          path.resolve(path.dirname(previewAssemblyFile), specifier),
        ),
      );

    const enginePreviewScene = stripKnownSourceExtension(
      path.join(previewSceneRoot, "runtimeScenes"),
    );
    const deletedPreviewScene = stripKnownSourceExtension(
      path.join(GAME_ROOT, "scenes", "PreviewScene"),
    );

    expect(importPaths).toContain(enginePreviewScene);
    expect(importPaths).not.toContain(deletedPreviewScene);
    expect(sourceText).toContain("/scene/runtimeScenes");
    expect(sourceText).not.toContain("/scene/public");
    expect(sourceText).toContain("createPreviewRuntimeScene");
  });

  test("engine preview scene module does not import from game assets, application, or scenes", () => {
    const enginePreviewSceneFile = path.join(
      ENGINE_ROOT,
      "preview-runtime",
      "scene",
      "createPreviewRuntimeScene.ts",
    );
    const sourceText = fs.readFileSync(enginePreviewSceneFile, "utf8");
    const importPaths = listImportSpecifiers(sourceText)
      .filter((specifier) => specifier.startsWith("."))
      .map((specifier) =>
        stripKnownSourceExtension(
          path.resolve(path.dirname(enginePreviewSceneFile), specifier),
        ),
      );

    const forbiddenRoots = [
      stripKnownSourceExtension(path.join(GAME_ROOT, "assets")),
      stripKnownSourceExtension(path.join(GAME_ROOT, "application")),
      stripKnownSourceExtension(path.join(GAME_ROOT, "scenes")),
      stripKnownSourceExtension(path.join(GAME_ROOT, "session")),
    ];

    const violations: string[] = [];
    for (const importPath of importPaths) {
      for (const forbidden of forbiddenRoots) {
        if (
          importPath === forbidden ||
          importPath.startsWith(`${forbidden}${path.sep}`)
        ) {
          violations.push(importPath);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("engine preload scene module does not import from game assets, application, or scenes", () => {
    const enginePreloadSceneFile = path.join(
      ENGINE_ROOT,
      "world-runtime",
      "scene",
      "createPreloadRuntimeScene.ts",
    );
    const sourceText = fs.readFileSync(enginePreloadSceneFile, "utf8");
    const importPaths = listImportSpecifiers(sourceText)
      .filter((specifier) => specifier.startsWith("."))
      .map((specifier) =>
        stripKnownSourceExtension(
          path.resolve(path.dirname(enginePreloadSceneFile), specifier),
        ),
      );

    const forbiddenRoots = [
      stripKnownSourceExtension(path.join(GAME_ROOT, "assets")),
      stripKnownSourceExtension(path.join(GAME_ROOT, "application")),
      stripKnownSourceExtension(path.join(GAME_ROOT, "scenes")),
      stripKnownSourceExtension(path.join(GAME_ROOT, "session")),
    ];

    const violations: string[] = [];
    for (const importPath of importPaths) {
      for (const forbidden of forbiddenRoots) {
        if (
          importPath === forbidden ||
          importPath.startsWith(`${forbidden}${path.sep}`)
        ) {
          violations.push(importPath);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("runtime assembly entrypoints import runtime host factories from engine", () => {
    const engineRuntimeHostRoot = path.join(ENGINE_ROOT, "runtime-host");
    const assemblyFiles = [
      path.join(
        SRC_ROOT,
        "game",
        "runtime",
        "assembly",
        "createWorldRuntimeHostAssembly.ts",
      ),
      path.join(
        SRC_ROOT,
        "game",
        "runtime",
        "assembly",
        "createPreviewRuntimeHostAssembly.ts",
      ),
    ];
    const missingEngineImports: string[] = [];

    for (const filePath of assemblyFiles) {
      const sourceText = fs.readFileSync(filePath, "utf8");
      const importsFromEngineHost = listImportSpecifiers(sourceText)
        .filter((specifier) => specifier.startsWith("."))
        .some((specifier) => {
          const resolved = stripKnownSourceExtension(
            path.resolve(path.dirname(filePath), specifier),
          );
          return resolved === stripKnownSourceExtension(engineRuntimeHostRoot);
        });

      if (!importsFromEngineHost) {
        missingEngineImports.push(path.relative(SRC_ROOT, filePath));
      }
    }

    expect(missingEngineImports).toEqual([]);
  });

  test("runtime assembly and ui session seams avoid scene bootstrap type imports", () => {
    const contractBoundaryFiles = [
      path.join(
        SRC_ROOT,
        "game",
        "runtime",
        "assembly",
        "createWorldRuntimeHostAssembly.ts",
      ),
      path.join(
        SRC_ROOT,
        "game",
        "runtime",
        "assembly",
        "createPreviewRuntimeHostAssembly.ts",
      ),
      path.join(UI_SESSION_HOOKS_ROOT, "useGameSession.ts"),
      path.join(UI_SESSION_HOOKS_ROOT, "useRuntimeUiBridge.ts"),
      path.join(UI_SESSION_HOOKS_ROOT, "runtimeUiBridgeHooks.ts"),
      path.join(
        UI_ROOT,
        "editors",
        "office-layout",
        "draft-state",
        "useOfficeLayoutEditor.ts",
      ),
    ];

    const violations = contractBoundaryFiles
      .filter((filePath) =>
        FORBIDDEN_OFFICE_SCENE_CONTRACT_IMPORT_PATTERN.test(
          fs.readFileSync(filePath, "utf8"),
        ),
      )
      .map((filePath) => path.relative(SRC_ROOT, filePath));

    expect(violations).toEqual([]);
  });

  test("world runtime transport imports are confined to explicit adapter files", () => {
    const worldRoot = path.join(RUNTIME_ROOT, "world");
    const runtimeTransportRoot = stripKnownSourceExtension(
      path.join(RUNTIME_ROOT, "transport"),
    );
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(worldRoot)) {
      if (ALLOWED_WORLD_TRANSPORT_ADAPTERS.has(path.basename(filePath))) {
        continue;
      }

      const importPaths = listImportSpecifiers(
        fs.readFileSync(filePath, "utf8"),
      )
        .filter((specifier) => specifier.startsWith("."))
        .map((specifier) =>
          stripKnownSourceExtension(
            path.resolve(path.dirname(filePath), specifier),
          ),
        );

      if (
        importPaths.some(
          (resolvedPath) =>
            resolvedPath === runtimeTransportRoot ||
            resolvedPath.startsWith(`${runtimeTransportRoot}${path.sep}`),
        )
      ) {
        violations.push(path.relative(SRC_ROOT, filePath));
      }
    }

    expect(violations).toEqual([]);
  });

  test("game session owner files do not import main runtime payload types from transport", () => {
    const sessionOwnerFiles = [
      path.join(GAME_ROOT, "session", "GameSession.ts"),
      path.join(GAME_ROOT, "session", "PreviewSession.ts"),
    ];
    const forbiddenTransportFiles = new Set([
      stripKnownSourceExtension(
        path.join(RUNTIME_ROOT, "transport", "runtimeEvents"),
      ),
      stripKnownSourceExtension(
        path.join(RUNTIME_ROOT, "transport", "uiCommands"),
      ),
      stripKnownSourceExtension(
        path.join(RUNTIME_ROOT, "transport", "placeDragPayload"),
      ),
      stripKnownSourceExtension(
        path.join(RUNTIME_ROOT, "transport", "previewEvents"),
      ),
    ]);
    const violations: string[] = [];

    for (const filePath of sessionOwnerFiles) {
      const sourceText = fs.readFileSync(filePath, "utf8");

      for (const specifier of listImportSpecifiers(sourceText)) {
        if (!specifier.startsWith(".")) {
          continue;
        }

        const resolvedPath = stripKnownSourceExtension(
          path.resolve(path.dirname(filePath), specifier),
        );

        if (forbiddenTransportFiles.has(resolvedPath)) {
          violations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(TEST_DIR, "..");
const FRONTEND_ROOT = path.resolve(SRC_ROOT, "..");
const GAME_ROOT = path.join(SRC_ROOT, "game");
const ENGINE_ROOT = path.join(SRC_ROOT, "engine");
const UI_ROOT = path.join(SRC_ROOT, "ui");
const CONFIG_ROOT = path.join(SRC_ROOT, "config");
const DATA_ROOT = path.join(SRC_ROOT, "data");
const TELEMETRY_ROOT = path.join(SRC_ROOT, "telemetry");
const APPLICATION_ROOT = path.join(GAME_ROOT, "application");
const CONTENT_ROOT = path.join(GAME_ROOT, "content");
const RUNTIME_ROOT = path.join(GAME_ROOT, "runtime");
const SESSION_ROOT = path.join(GAME_ROOT, "session");
const GAME_SCENES_ROOT = path.join(GAME_ROOT, "scenes");
const TOWN_ROOT = path.join(GAME_ROOT, "town");
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

describe("runtime ownership boundary", () => {
  test("stage 17 session owners and runtime assembly exist and the runtime gateway owner is removed", () => {
    expect(fs.existsSync(RUNTIME_ROOT)).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          RUNTIME_ROOT,
          "assembly",
          "createWorldRuntimeHostAssembly.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          RUNTIME_ROOT,
          "assembly",
          "createPreviewRuntimeHostAssembly.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(SESSION_ROOT, "runtime", "createMountedGameSession.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(SESSION_ROOT, "preview", "createMountedPreviewSession.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(RUNTIME_ROOT, "gateway", "runtimeGateway.ts")),
    ).toBe(false);
    expect(
      fs.existsSync(
        path.join(RUNTIME_ROOT, "gateway", "previewRuntimeGateway.ts"),
      ),
    ).toBe(false);
    expect(fs.existsSync(path.join(GAME_ROOT, "protocol.ts"))).toBe(false);
    expect(
      fs.existsSync(path.join(GAME_ROOT, "previewRuntimeContract.ts")),
    ).toBe(false);
    expect(
      fs.existsSync(path.join(APPLICATION_ROOT, "runtimeGateway.ts")),
    ).toBe(false);
  });

  test("stage 19 runtime compilation and document translation owners exist", () => {
    expect(
      fs.existsSync(
        path.join(
          APPLICATION_ROOT,
          "runtime-compilation",
          "load-plans",
          "runtimeBootstrap.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          APPLICATION_ROOT,
          "runtime-compilation",
          "structure-surfaces",
          "officeSceneBootstrap.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          APPLICATION_ROOT,
          "runtime-compilation",
          "terrain-surfaces",
          "terrainBootstrap.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(CONTENT_ROOT, "document-import", "officeLayoutDocument.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(CONTENT_ROOT, "document-export", "officeLayoutDocument.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(CONTENT_ROOT, "terrain", "terrainSeed.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(CONTENT_ROOT, "terrain", "terrainRuleset.ts")),
    ).toBe(true);
  });

  test("stage 5 engine runtime-host exists and game/phaser is removed", () => {
    expect(fs.existsSync(path.join(ENGINE_ROOT, "runtime-host"))).toBe(true);
    expect(fs.existsSync(path.join(GAME_ROOT, "phaser", "createGame.ts"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(GAME_ROOT, "phaser", "config.ts"))).toBe(
      false,
    );
  });

  test("stage 6 engine world-runtime primitives exist and legacy game primitives are removed", () => {
    const worldRuntimeRoot = path.join(ENGINE_ROOT, "world-runtime");
    expect(
      fs.existsSync(
        path.join(
          worldRuntimeRoot,
          "camera",
          "worldRuntimeCameraController.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(worldRuntimeRoot, "input", "worldRuntimeInputRouter.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          worldRuntimeRoot,
          "diagnostics",
          "worldRuntimeDiagnosticsController.ts",
        ),
      ),
    ).toBe(true);

    const worldSceneRoot = path.join(GAME_ROOT, "scenes", "world");
    expect(
      fs.existsSync(path.join(worldSceneRoot, "worldSceneCameraController.ts")),
    ).toBe(false);
    expect(fs.existsSync(path.join(worldSceneRoot, "inputRouter.ts"))).toBe(
      false,
    );
    expect(
      fs.existsSync(
        path.join(worldSceneRoot, "worldSceneDiagnosticsController.ts"),
      ),
    ).toBe(false);
  });

  test("stage 7 engine world-runtime scene lifecycle exists and legacy game scene shells are removed", () => {
    const sceneRoot = path.join(ENGINE_ROOT, "world-runtime", "scene");
    expect(fs.existsSync(path.join(sceneRoot, "runtimeSceneKeys.ts"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(sceneRoot, "contracts.ts"))).toBe(true);
    expect(
      fs.existsSync(path.join(sceneRoot, "createBootRuntimeScene.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(sceneRoot, "createWorldRuntimeScene.ts")),
    ).toBe(true);

    expect(fs.existsSync(path.join(GAME_ROOT, "scenes", "BootScene.ts"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(GAME_ROOT, "scenes", "WorldScene.ts"))).toBe(
      false,
    );
  });

  test("stage 8 engine preload scene lifecycle exists and legacy game preload scene is removed", () => {
    const sceneRoot = path.join(ENGINE_ROOT, "world-runtime", "scene");
    expect(
      fs.existsSync(path.join(sceneRoot, "createPreloadRuntimeScene.ts")),
    ).toBe(true);

    expect(
      fs.existsSync(path.join(GAME_ROOT, "scenes", "PreloadScene.ts")),
    ).toBe(false);
  });

  test("stage 9 engine preview scene lifecycle exists and legacy game preview scene is removed", () => {
    const previewSceneRoot = path.join(ENGINE_ROOT, "preview-runtime", "scene");
    expect(
      fs.existsSync(path.join(previewSceneRoot, "previewSceneKeys.ts")),
    ).toBe(true);
    expect(fs.existsSync(path.join(previewSceneRoot, "contracts.ts"))).toBe(
      true,
    );
    expect(
      fs.existsSync(
        path.join(previewSceneRoot, "createPreviewRuntimeScene.ts"),
      ),
    ).toBe(true);

    expect(
      fs.existsSync(path.join(GAME_ROOT, "scenes", "PreviewScene.ts")),
    ).toBe(false);
  });

  test("stage 11 runtime owns office and world modules and game/scenes is retired", () => {
    expect(
      fs.existsSync(path.join(RUNTIME_ROOT, "office", "bootstrap.ts")),
    ).toBe(true);
    expect(fs.existsSync(path.join(RUNTIME_ROOT, "office", "render.ts"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(RUNTIME_ROOT, "world", "worldSceneAssembly.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(RUNTIME_ROOT, "world", "worldSceneCommandBindings.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(RUNTIME_ROOT, "world", "worldSceneOfficeRuntime.ts"),
      ),
    ).toBe(true);
    expect(fs.existsSync(GAME_SCENES_ROOT)).toBe(false);
  });

  test("stage 15 engine world-region and spatial owners exist and the retired game owners are removed", () => {
    const worldRuntimeRoot = path.join(ENGINE_ROOT, "world-runtime");
    expect(
      fs.existsSync(
        path.join(worldRuntimeRoot, "regions", "anchoredGridRegion.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(worldRuntimeRoot, "spatial", "unifiedCollisionMap.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(worldRuntimeRoot, "spatial", "navigationService.ts"),
      ),
    ).toBe(true);

    expect(fs.existsSync(path.join(TOWN_ROOT, "layout.ts"))).toBe(false);
    expect(fs.existsSync(path.join(TOWN_ROOT, "collisionGrid.ts"))).toBe(false);
    expect(
      fs.existsSync(path.join(RUNTIME_ROOT, "world", "navigation.ts")),
    ).toBe(false);
    expect(fs.existsSync(TOWN_ROOT)).toBe(false);
  });

  test("stage 19 runtime consumers read the new compilation owners directly", () => {
    const preloadLifecycleSource = fs.readFileSync(
      path.join(
        RUNTIME_ROOT,
        "preload",
        "createWorldRuntimePreloadLifecycle.ts",
      ),
      "utf8",
    );
    const worldLifecycleSource = fs.readFileSync(
      path.join(RUNTIME_ROOT, "world", "createWorldSceneLifecycle.ts"),
      "utf8",
    );
    const terrainRuntimeSource = fs.readFileSync(
      path.join(GAME_ROOT, "terrain", "runtime.ts"),
      "utf8",
    );

    expect(preloadLifecycleSource).toContain(
      "../../application/runtime-compilation/load-plans/runtimeBootstrap",
    );
    expect(preloadLifecycleSource).toContain(
      "../../application/runtime-compilation/structure-surfaces/officeSceneBootstrap",
    );
    expect(preloadLifecycleSource).not.toContain(
      "../../application/gameComposition",
    );
    expect(preloadLifecycleSource).not.toContain("../office/bootstrap");

    expect(worldLifecycleSource).toContain(
      "../../application/runtime-compilation/load-plans/runtimeBootstrap",
    );
    expect(worldLifecycleSource).toContain(
      "../../application/runtime-compilation/structure-surfaces/officeSceneBootstrap",
    );
    expect(worldLifecycleSource).not.toContain(
      "../../application/gameComposition",
    );
    expect(worldLifecycleSource).not.toContain("../office/bootstrap");

    expect(terrainRuntimeSource).toContain(
      "../application/runtime-compilation/terrain-surfaces/terrainBootstrap",
    );
    expect(terrainRuntimeSource).not.toContain('from "./bootstrap"');
  });

  test("stage 19 former translation owners no longer keep the moved translation logic", () => {
    const officeLayoutEditorServiceSource = fs.readFileSync(
      path.join(APPLICATION_ROOT, "officeLayoutEditorService.ts"),
      "utf8",
    );
    const gameCompositionSource = fs.readFileSync(
      path.join(APPLICATION_ROOT, "gameComposition.ts"),
      "utf8",
    );
    const officeBootstrapSource = fs.readFileSync(
      path.join(RUNTIME_ROOT, "office", "bootstrap.ts"),
      "utf8",
    );
    const terrainBootstrapSource = fs.readFileSync(
      path.join(GAME_ROOT, "terrain", "bootstrap.ts"),
      "utf8",
    );

    expect(officeLayoutEditorServiceSource).not.toContain("parseOfficeLayout");
    expect(officeLayoutEditorServiceSource).not.toContain("formatOfficeLayout");
    expect(officeLayoutEditorServiceSource).not.toContain(
      "syncFromRuntimeLayout",
    );

    expect(gameCompositionSource).not.toContain("buildAnimationCatalog");
    expect(gameCompositionSource).not.toContain(
      "buildEntityRegistryFromCatalog",
    );
    expect(gameCompositionSource).not.toContain("listTerrainPlaceables");

    expect(officeBootstrapSource).not.toContain("officeSceneContentRepository");
    expect(officeBootstrapSource).not.toContain("fallbackFootprintFromPixels");

    expect(terrainBootstrapSource).not.toContain("seed.phase1.json");
    expect(terrainBootstrapSource).not.toContain("ruleset.phase1.json");
    expect(terrainBootstrapSource).not.toContain("toTerrainGridSpec");
  });

  test("stage 23 publishes terrain runtime assets and routes terrain interpretation through asset-catalog", () => {
    const terrainAssetCatalogSource = fs.readFileSync(
      path.join(CONTENT_ROOT, "asset-catalog", "terrainContentRepository.ts"),
      "utf8",
    );
    const terrainBootstrapCompilationSource = fs.readFileSync(
      path.join(
        APPLICATION_ROOT,
        "runtime-compilation",
        "terrain-surfaces",
        "terrainBootstrap.ts",
      ),
      "utf8",
    );
    const engineSourceRoots = [
      path.join(ENGINE_ROOT, "terrain"),
      path.join(ENGINE_ROOT, "structures"),
    ];
    const engineViolations: string[] = [];

    expect(
      fs.existsSync(
        path.join(PUBLIC_ASSETS_ROOT, "terrain", "rulesets", "phase1.json"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(PUBLIC_ASSETS_ROOT, "terrain", "seeds", "phase1.json"),
      ),
    ).toBe(true);

    expect(terrainAssetCatalogSource).toContain(
      "public-assets-json:terrain/rulesets/phase1.json",
    );
    expect(terrainAssetCatalogSource).toContain(
      "public-assets-json:terrain/seeds/phase1.json",
    );
    expect(terrainBootstrapCompilationSource).toContain(
      "../../../content/asset-catalog/terrainContentRepository",
    );
    expect(terrainBootstrapCompilationSource).not.toContain(
      "../../../content/terrain",
    );
    expect(terrainBootstrapCompilationSource).not.toContain("terrain/data");

    for (const engineRoot of engineSourceRoots) {
      for (const filePath of collectSourceFiles(engineRoot)) {
        const sourceText = fs.readFileSync(filePath, "utf8");

        if (
          sourceText.includes("public-assets-json:terrain/") ||
          sourceText.includes("public/assets/terrain/")
        ) {
          engineViolations.push(path.relative(SRC_ROOT, filePath));
        }
      }
    }

    expect(engineViolations).toEqual([]);
  });

  test("stage 22 creates concrete application owners and removes the active ui-side projection owner", () => {
    expect(
      fs.existsSync(
        path.join(
          APPLICATION_ROOT,
          "command-handlers",
          "officeEditorToolPayload.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(APPLICATION_ROOT, "command-handlers", "placeDragPayload.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          APPLICATION_ROOT,
          "use-cases",
          "officeLayoutEditorService.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(APPLICATION_ROOT, "use-cases", "previewRuntimeBridge.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(APPLICATION_ROOT, "transactions", "runtimeBridgeState.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          APPLICATION_ROOT,
          "projections",
          "runtimeSidebarProjection.ts",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          UI_ROOT,
          "game-session",
          "view-models",
          "runtimeBridgeState.ts",
        ),
      ),
    ).toBe(false);
  });

  test("stage 22 engine terrain and structure runtime owners exist and game shims read public engine barrels", () => {
    expect(fs.existsSync(path.join(ENGINE_ROOT, "index.ts"))).toBe(true);
    expect(fs.existsSync(path.join(ENGINE_ROOT, "terrain", "index.ts"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(ENGINE_ROOT, "terrain", "terrainRenderer.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(ENGINE_ROOT, "terrain", "terrainRuntime.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(ENGINE_ROOT, "structures", "index.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(ENGINE_ROOT, "structures", "contracts.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(ENGINE_ROOT, "structures", "renderOfficeLayout.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(ENGINE_ROOT, "world-runtime", "scene", "index.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(ENGINE_ROOT, "preview-runtime", "scene", "index.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(ENGINE_ROOT, "world-runtime", "scene", "runtimeScenes.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(ENGINE_ROOT, "preview-runtime", "scene", "runtimeScenes.ts"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(ENGINE_ROOT, "world-runtime", "scene", "public.ts"),
      ),
    ).toBe(false);
    expect(
      fs.existsSync(
        path.join(ENGINE_ROOT, "preview-runtime", "scene", "public.ts"),
      ),
    ).toBe(false);

    const terrainRendererSource = fs.readFileSync(
      path.join(GAME_ROOT, "terrain", "renderer.ts"),
      "utf8",
    );
    const officeRenderSource = fs.readFileSync(
      path.join(RUNTIME_ROOT, "office", "render.ts"),
      "utf8",
    );
    const officeContractSource = fs.readFileSync(
      path.join(GAME_ROOT, "officeLayoutContract.ts"),
      "utf8",
    );

    expect(terrainRendererSource).not.toContain('from "phaser"');
    expect(terrainRendererSource).toContain("../../engine/terrain");

    expect(officeRenderSource).not.toContain('from "phaser"');
    expect(officeRenderSource).toContain("../../../engine/structures");

    expect(officeContractSource).toContain("./contracts/office-scene");
  });

  test("production source files do not import the retired game/scenes namespace", () => {
    const gameScenesRoot = stripKnownSourceExtension(GAME_SCENES_ROOT);
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
          resolvedPath === gameScenesRoot ||
          resolvedPath.startsWith(`${gameScenesRoot}${path.sep}`)
        ) {
          violations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("production source files do not import the retired game town and world navigation owners", () => {
    const retiredOwners = [
      stripKnownSourceExtension(path.join(TOWN_ROOT, "layout.ts")),
      stripKnownSourceExtension(path.join(TOWN_ROOT, "collisionGrid.ts")),
      stripKnownSourceExtension(
        path.join(RUNTIME_ROOT, "world", "navigation.ts"),
      ),
      stripKnownSourceExtension(TOWN_ROOT),
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
          violations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("stage 15 engine world-region and spatial modules do not import forbidden owners", () => {
    const engineBoundaryRoots = [
      path.join(ENGINE_ROOT, "world-runtime", "regions"),
      path.join(ENGINE_ROOT, "world-runtime", "spatial"),
    ];
    const forbiddenRoots = [
      stripKnownSourceExtension(UI_ROOT),
      stripKnownSourceExtension(DATA_ROOT),
      stripKnownSourceExtension(APPLICATION_ROOT),
      stripKnownSourceExtension(CONTENT_ROOT),
      stripKnownSourceExtension(PUBLIC_ASSETS_ROOT),
    ];
    const violations: string[] = [];

    for (const boundaryRoot of engineBoundaryRoots) {
      for (const filePath of collectSourceFiles(boundaryRoot)) {
        const sourceText = fs.readFileSync(filePath, "utf8");

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
            violations.push(
              `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
            );
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("stage 21 engine terrain and structure modules do not import forbidden owners", () => {
    const engineBoundaryRoots = [
      path.join(ENGINE_ROOT, "terrain"),
      path.join(ENGINE_ROOT, "structures"),
    ];
    const forbiddenRoots = [
      stripKnownSourceExtension(UI_ROOT),
      stripKnownSourceExtension(DATA_ROOT),
      stripKnownSourceExtension(APPLICATION_ROOT),
      stripKnownSourceExtension(CONTENT_ROOT),
      stripKnownSourceExtension(path.join(GAME_ROOT, "world")),
      stripKnownSourceExtension(PUBLIC_ASSETS_ROOT),
    ];
    const violations: string[] = [];

    for (const boundaryRoot of engineBoundaryRoots) {
      for (const filePath of collectSourceFiles(boundaryRoot)) {
        const sourceText = fs.readFileSync(filePath, "utf8");

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
            violations.push(
              `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
            );
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("runtime assembly files do not import Phaser directly", () => {
    const assemblyFiles = [
      path.join(RUNTIME_ROOT, "assembly", "createWorldRuntimeHostAssembly.ts"),
      path.join(
        RUNTIME_ROOT,
        "assembly",
        "createPreviewRuntimeHostAssembly.ts",
      ),
    ];
    const violations: string[] = [];

    for (const filePath of assemblyFiles) {
      const sourceText = fs.readFileSync(filePath, "utf8");
      if (
        sourceText.includes('from "phaser"') ||
        sourceText.includes("from 'phaser'")
      ) {
        violations.push(path.relative(SRC_ROOT, filePath));
      }
    }

    expect(violations).toEqual([]);
  });

  test("remaining Phaser imports in game are limited to the allowed runtime adapter seams", () => {
    const allowedFiles = new Set([
      path.join(GAME_ROOT, "content", "preload", "animation.ts"),
      path.join(GAME_ROOT, "content", "preload", "preload.ts"),
      path.join(RUNTIME_ROOT, "preview", "createPreviewSceneLifecycle.ts"),
      path.join(
        RUNTIME_ROOT,
        "preload",
        "createWorldRuntimePreloadLifecycle.ts",
      ),
      path.join(RUNTIME_ROOT, "world", "animationSystem.ts"),
      path.join(RUNTIME_ROOT, "world", "createWorldSceneLifecycle.ts"),
      path.join(RUNTIME_ROOT, "world", "entityFactory.ts"),
      path.join(RUNTIME_ROOT, "world", "entitySystem.ts"),
      path.join(RUNTIME_ROOT, "world", "types.ts"),
      path.join(RUNTIME_ROOT, "world", "worldSceneAssembly.ts"),
      path.join(RUNTIME_ROOT, "world", "worldSceneOfficeEditorController.ts"),
      path.join(RUNTIME_ROOT, "world", "worldSceneOfficeRuntime.ts"),
      path.join(RUNTIME_ROOT, "world", "worldSceneSelectionController.ts"),
      path.join(RUNTIME_ROOT, "world", "worldSceneTerrainController.ts"),
      path.join(RUNTIME_ROOT, "world", "worldSceneTerrainPropController.ts"),
    ]);
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(GAME_ROOT)) {
      const sourceText = fs.readFileSync(filePath, "utf8");
      const importsPhaser =
        sourceText.includes('from "phaser"') ||
        sourceText.includes("from 'phaser'");

      if (importsPhaser && !allowedFiles.has(filePath)) {
        violations.push(path.relative(SRC_ROOT, filePath));
      }
    }

    expect(violations).toEqual([]);
  });

  test("game application code does not own phaser or runtime transport imports", () => {
    const runtimeRoot = stripKnownSourceExtension(RUNTIME_ROOT);
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(APPLICATION_ROOT)) {
      const sourceText = fs.readFileSync(filePath, "utf8");

      if (
        sourceText.includes('from "phaser"') ||
        sourceText.includes("from 'phaser'")
      ) {
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
          resolvedPath === runtimeRoot ||
          resolvedPath.startsWith(`${runtimeRoot}${path.sep}`)
        ) {
          violations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("production game source imports engine only through explicit engine public barrels", () => {
    const allowedEngineImportTargets = new Set([
      stripKnownSourceExtension(ENGINE_ROOT),
      stripKnownSourceExtension(path.join(ENGINE_ROOT, "index")),
      stripKnownSourceExtension(path.join(ENGINE_ROOT, "terrain")),
      stripKnownSourceExtension(path.join(ENGINE_ROOT, "terrain", "index")),
      stripKnownSourceExtension(path.join(ENGINE_ROOT, "structures")),
      stripKnownSourceExtension(path.join(ENGINE_ROOT, "structures", "index")),
      stripKnownSourceExtension(path.join(ENGINE_ROOT, "runtime-host")),
      stripKnownSourceExtension(
        path.join(ENGINE_ROOT, "runtime-host", "index"),
      ),
      stripKnownSourceExtension(
        path.join(ENGINE_ROOT, "preview-runtime", "scene"),
      ),
      stripKnownSourceExtension(
        path.join(ENGINE_ROOT, "preview-runtime", "scene", "index"),
      ),
      stripKnownSourceExtension(
        path.join(ENGINE_ROOT, "preview-runtime", "scene", "runtimeScenes"),
      ),
      stripKnownSourceExtension(
        path.join(ENGINE_ROOT, "world-runtime", "scene"),
      ),
      stripKnownSourceExtension(
        path.join(ENGINE_ROOT, "world-runtime", "scene", "index"),
      ),
      stripKnownSourceExtension(
        path.join(ENGINE_ROOT, "world-runtime", "scene", "runtimeScenes"),
      ),
      stripKnownSourceExtension(
        path.join(ENGINE_ROOT, "world-runtime", "regions"),
      ),
      stripKnownSourceExtension(
        path.join(ENGINE_ROOT, "world-runtime", "regions", "index"),
      ),
      stripKnownSourceExtension(
        path.join(ENGINE_ROOT, "world-runtime", "spatial"),
      ),
      stripKnownSourceExtension(
        path.join(ENGINE_ROOT, "world-runtime", "spatial", "index"),
      ),
    ]);
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(GAME_ROOT)) {
      const sourceText = fs.readFileSync(filePath, "utf8");

      for (const specifier of listImportSpecifiers(sourceText)) {
        if (!specifier.startsWith(".")) {
          continue;
        }

        const resolvedPath = stripKnownSourceExtension(
          path.resolve(path.dirname(filePath), specifier),
        );

        if (
          (resolvedPath === stripKnownSourceExtension(ENGINE_ROOT) ||
            resolvedPath.startsWith(
              `${stripKnownSourceExtension(ENGINE_ROOT)}${path.sep}`,
            )) &&
          !allowedEngineImportTargets.has(resolvedPath)
        ) {
          violations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("stage end introduces concrete ui theme and shared panel-state owners", () => {
    expect(fs.existsSync(path.join(UI_ROOT, "theme", "theme.css"))).toBe(true);
    expect(
      fs.existsSync(path.join(UI_ROOT, "state", "panel-state", "index.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(UI_ROOT, "state", "panel-state", "useDisclosureState.ts"),
      ),
    ).toBe(true);

    const mainSource = fs.readFileSync(path.join(SRC_ROOT, "main.tsx"), "utf8");
    expect(mainSource).toContain("./ui/theme/theme.css");
  });

  test("production source does not depend on compatibility public barrels", () => {
    const retiredPublicBarrels = new Set([
      stripKnownSourceExtension(
        path.join(ENGINE_ROOT, "preview-runtime", "scene", "public"),
      ),
      stripKnownSourceExtension(
        path.join(ENGINE_ROOT, "world-runtime", "scene", "public"),
      ),
    ]);
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(SRC_ROOT)) {
      for (const specifier of listImportSpecifiers(
        fs.readFileSync(filePath, "utf8"),
      )) {
        if (!specifier.startsWith(".")) {
          continue;
        }

        const resolvedPath = stripKnownSourceExtension(
          path.resolve(path.dirname(filePath), specifier),
        );

        if (retiredPublicBarrels.has(resolvedPath)) {
          violations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("production game source does not import engine factory internals", () => {
    const engineRoot = stripKnownSourceExtension(ENGINE_ROOT);
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(GAME_ROOT)) {
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
          (resolvedPath === engineRoot ||
            resolvedPath.startsWith(`${engineRoot}${path.sep}`)) &&
          ["factory", "factories"].includes(path.basename(resolvedPath))
        ) {
          violations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("config and telemetry remain top-level app-service modules", () => {
    const configForbiddenRoots = [
      stripKnownSourceExtension(UI_ROOT),
      stripKnownSourceExtension(GAME_ROOT),
      stripKnownSourceExtension(ENGINE_ROOT),
      stripKnownSourceExtension(DATA_ROOT),
      stripKnownSourceExtension(PUBLIC_ASSETS_ROOT),
      stripKnownSourceExtension(TELEMETRY_ROOT),
    ];
    const telemetryForbiddenRoots = [
      stripKnownSourceExtension(UI_ROOT),
      stripKnownSourceExtension(GAME_ROOT),
      stripKnownSourceExtension(ENGINE_ROOT),
      stripKnownSourceExtension(DATA_ROOT),
      stripKnownSourceExtension(PUBLIC_ASSETS_ROOT),
    ];
    const violations: string[] = [];

    for (const filePath of collectSourceFiles(CONFIG_ROOT)) {
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
          configForbiddenRoots.some(
            (forbiddenRoot) =>
              resolvedPath === forbiddenRoot ||
              resolvedPath.startsWith(`${forbiddenRoot}${path.sep}`),
          )
        ) {
          violations.push(
            `${path.relative(SRC_ROOT, filePath)} -> ${specifier}`,
          );
        }
      }
    }

    for (const filePath of collectSourceFiles(TELEMETRY_ROOT)) {
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
          telemetryForbiddenRoots.some(
            (forbiddenRoot) =>
              resolvedPath === forbiddenRoot ||
              resolvedPath.startsWith(`${forbiddenRoot}${path.sep}`),
          )
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

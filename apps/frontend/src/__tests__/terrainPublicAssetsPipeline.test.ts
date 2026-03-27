import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(TEST_DIR, "../..");
const WORKSPACE_ROOT = path.resolve(FRONTEND_ROOT, "..", "..");
const PUBLIC_ASSET_PIPELINE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages",
  "public-assets",
  "pipeline",
  "export_public_assets.py",
);
const CANONICAL_TERRAIN_ROOT = path.join(
  FRONTEND_ROOT,
  "public",
  "assets",
  "terrain",
);
const CANONICAL_TERRAIN_SEED_SOURCE_PATH = path.join(
  CANONICAL_TERRAIN_ROOT,
  "seeds",
  "phase1.json",
);
const CANONICAL_TERRAIN_RULESET_SOURCE_PATH = path.join(
  CANONICAL_TERRAIN_ROOT,
  "rulesets",
  "phase1.json",
);

type CommandFailure = Error & {
  code?: number;
  stderr?: string | Buffer;
  stdout?: string | Buffer;
};

async function runPublicAssetsDryRun(terrainRoot: string): Promise<void> {
  await execFileAsync("python3", [PUBLIC_ASSET_PIPELINE_PATH, "--dry-run"], {
    cwd: WORKSPACE_ROOT,
    env: {
      ...process.env,
      TOWNCORD_TERRAIN_PUBLIC_ROOT: terrainRoot,
    },
    maxBuffer: 20 * 1024 * 1024,
  });
}

async function expectDryRunFailure(terrainRoot: string): Promise<string> {
  try {
    await runPublicAssetsDryRun(terrainRoot);
  } catch (error) {
    const failure = error as CommandFailure;
    return `${failure.stdout ?? ""}\n${failure.stderr ?? ""}`;
  }

  throw new Error("Expected public-assets dry run to fail.");
}

async function withTemporaryTerrainRoot<T>(
  run: (paths: {
    terrainRoot: string;
    terrainSeedPath: string;
    terrainRulesetPath: string;
  }) => Promise<T>,
): Promise<T> {
  const terrainRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "towncord-terrain-public-assets-"),
  );
  const terrainSeedPath = path.join(terrainRoot, "seeds", "phase1.json");
  const terrainRulesetPath = path.join(terrainRoot, "rulesets", "phase1.json");

  await fs.mkdir(path.dirname(terrainSeedPath), { recursive: true });
  await fs.mkdir(path.dirname(terrainRulesetPath), { recursive: true });
  await fs.copyFile(CANONICAL_TERRAIN_SEED_SOURCE_PATH, terrainSeedPath);
  await fs.copyFile(CANONICAL_TERRAIN_RULESET_SOURCE_PATH, terrainRulesetPath);

  try {
    return await run({
      terrainRoot,
      terrainSeedPath,
      terrainRulesetPath,
    });
  } finally {
    await fs.rm(terrainRoot, { recursive: true, force: true });
  }
}

async function withMovedFile<T>(
  filePath: string,
  run: () => Promise<T>,
): Promise<T> {
  const movedPath = `${filePath}.stage23-test-backup-${process.pid}-${Date.now()}`;
  await fs.rename(filePath, movedPath);

  try {
    return await run();
  } finally {
    await fs.rename(movedPath, filePath);
  }
}

async function withTemporaryFileContents<T>(
  filePath: string,
  contents: string,
  run: () => Promise<T>,
): Promise<T> {
  const originalContents = await fs.readFile(filePath, "utf8");
  await fs.writeFile(filePath, contents);

  try {
    return await run();
  } finally {
    await fs.writeFile(filePath, originalContents);
  }
}

describe.sequential("terrain public-assets pipeline", () => {
  test(
    "dry run fails when the terrain seed runtime artifact is missing",
    async () => {
      const output = await withTemporaryTerrainRoot(
        async ({ terrainRoot, terrainSeedPath }) =>
          withMovedFile(terrainSeedPath, () => expectDryRunFailure(terrainRoot)),
      );

      expect(output).toContain("Missing terrain seed runtime artifact");
    },
    30000,
  );

  test(
    "dry run fails when the terrain ruleset contains duplicate case ids",
    async () => {
      const output = await withTemporaryTerrainRoot(
        async ({ terrainRoot, terrainRulesetPath }) => {
          const ruleset = JSON.parse(
            await fs.readFile(terrainRulesetPath, "utf8"),
          ) as {
            transitions: Array<{
              rules: Array<{
                caseId: number;
                frame: string;
              }>;
            }>;
          };
          const duplicatedCaseId = ruleset.transitions[0]?.rules[0]?.caseId;

          if (duplicatedCaseId === undefined || !ruleset.transitions[0]?.rules[1]) {
            throw new Error("Expected the default terrain ruleset fixture to exist.");
          }

          ruleset.transitions[0].rules[1].caseId = duplicatedCaseId;

          return withTemporaryFileContents(
            terrainRulesetPath,
            `${JSON.stringify(ruleset, null, 2)}\n`,
            () => expectDryRunFailure(terrainRoot),
          );
        },
      );

      expect(output).toContain("duplicates caseId");
    },
    30000,
  );
});

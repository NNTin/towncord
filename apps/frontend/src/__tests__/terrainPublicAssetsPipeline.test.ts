import fs from "node:fs/promises";
import { execFile } from "node:child_process";
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
const TERRAIN_SEED_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages",
  "public-assets",
  "assets",
  "terrain",
  "seeds",
  "phase1.json",
);
const TERRAIN_RULESET_SOURCE_PATH = path.join(
  WORKSPACE_ROOT,
  "packages",
  "public-assets",
  "assets",
  "terrain",
  "rulesets",
  "phase1.json",
);

type CommandFailure = Error & {
  code?: number;
  stderr?: string | Buffer;
  stdout?: string | Buffer;
};

async function runPublicAssetsDryRun(): Promise<void> {
  await execFileAsync("python3", [PUBLIC_ASSET_PIPELINE_PATH, "--dry-run"], {
    cwd: WORKSPACE_ROOT,
    maxBuffer: 20 * 1024 * 1024,
  });
}

async function expectDryRunFailure(): Promise<string> {
  try {
    await runPublicAssetsDryRun();
  } catch (error) {
    const failure = error as CommandFailure;
    return `${failure.stdout ?? ""}\n${failure.stderr ?? ""}`;
  }

  throw new Error("Expected public-assets dry run to fail.");
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
      const output = await withMovedFile(TERRAIN_SEED_SOURCE_PATH, () =>
        expectDryRunFailure(),
      );

      expect(output).toContain("Missing terrain seed runtime artifact");
    },
    30000,
  );

  test(
    "dry run fails when the terrain ruleset contains duplicate case ids",
    async () => {
      const ruleset = JSON.parse(
        await fs.readFile(TERRAIN_RULESET_SOURCE_PATH, "utf8"),
      ) as {
        transitions: Array<{
          rules: Array<{
            caseId: number;
            frame: string;
          }>;
        }>;
      };
      const duplicatedCaseId =
        ruleset.transitions[0]?.rules[0]?.caseId;

      if (duplicatedCaseId === undefined || !ruleset.transitions[0]?.rules[1]) {
        throw new Error("Expected the default terrain ruleset fixture to exist.");
      }

      ruleset.transitions[0].rules[1].caseId = duplicatedCaseId;

      const output = await withTemporaryFileContents(
        TERRAIN_RULESET_SOURCE_PATH,
        `${JSON.stringify(ruleset, null, 2)}\n`,
        () => expectDryRunFailure(),
      );

      expect(output).toContain("duplicates caseId");
    },
    30000,
  );
});

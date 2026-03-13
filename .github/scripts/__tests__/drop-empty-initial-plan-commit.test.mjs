import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("../drop-empty-initial-plan-commit.sh", import.meta.url));

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    ...options,
  }).trim();
}

function runResult(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
}

async function createTempDir(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "drop-empty-initial-plan-commit-"));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  return dir;
}

async function writeGhStub(rootDir) {
  const binDir = path.join(rootDir, "bin");
  const ghPath = path.join(binDir, "gh");

  await mkdir(binDir, { recursive: true });
  await writeFile(
    ghPath,
    `#!/usr/bin/env bash
set -euo pipefail

if [[ "$1" == "auth" && "$2" == "status" ]]; then
  exit "\${GH_AUTH_EXIT_CODE:-0}"
fi

if [[ "$1" == "pr" && "$2" == "view" ]]; then
  if [[ "\${GH_PR_VIEW_EXIT_CODE:-0}" != "0" ]]; then
    echo "pull request not found" >&2
    exit "\${GH_PR_VIEW_EXIT_CODE}"
  fi

  printf '%s\\n' "\${GH_PR_BASE_REF:-main}"
  exit 0
fi

echo "unexpected gh invocation: $*" >&2
exit 64
`,
    { mode: 0o755 },
  );

  return binDir;
}

async function setupRepository(t, commits) {
  const rootDir = await createTempDir(t);
  const remotePath = path.join(rootDir, "remote.git");
  const repoPath = path.join(rootDir, "repo");

  run("git", ["init", "--bare", "--initial-branch=main", remotePath]);
  run("git", ["init", "--initial-branch=main", repoPath]);
  run("git", ["config", "user.name", "Test User"], { cwd: repoPath });
  run("git", ["config", "user.email", "test@example.com"], { cwd: repoPath });

  await writeFile(path.join(repoPath, "README.md"), "base\n");
  run("git", ["add", "README.md"], { cwd: repoPath });
  run("git", ["commit", "-m", "docs: initial commit"], { cwd: repoPath });
  run("git", ["remote", "add", "origin", remotePath], { cwd: repoPath });
  run("git", ["push", "-u", "origin", "main"], { cwd: repoPath });

  const featureBranch = "feature/drop-empty-initial-plan";
  run("git", ["checkout", "-b", featureBranch], { cwd: repoPath });

  let fileCounter = 0;
  for (const commit of commits) {
    if (commit.type === "empty") {
      run("git", ["commit", "--allow-empty", "-m", commit.message], { cwd: repoPath });
      continue;
    }

    fileCounter += 1;
    const relativePath = commit.file ?? `file-${fileCounter}.txt`;
    await writeFile(path.join(repoPath, relativePath), commit.contents ?? `${commit.message}\n`);
    run("git", ["add", relativePath], { cwd: repoPath });
    run("git", ["commit", "-m", commit.message], { cwd: repoPath });
  }

  run("git", ["push", "-u", "origin", featureBranch], { cwd: repoPath });

  const stubBinDir = await writeGhStub(rootDir);
  const env = {
    ...process.env,
    PATH: `${stubBinDir}:${process.env.PATH}`,
    GH_PR_BASE_REF: "main",
  };

  return {
    env,
    featureBranch,
    repoPath,
  };
}

function assertSuccess(result, message) {
  assert.equal(result.status, 0, message ?? result.stderr);
}

function assertFailure(result, expectedPattern) {
  assert.notEqual(result.status, 0, "expected command to fail");
  assert.match(result.stderr, expectedPattern);
}

test("drops a single empty Initial plan commit and force-pushes the rewritten branch", async (t) => {
  const { env, featureBranch, repoPath } = await setupRepository(t, [
    { type: "empty", message: "Initial plan" },
    { type: "file", message: "fix: add follow-up changes", contents: "feature\n" },
  ]);

  const result = runResult("bash", [scriptPath], { cwd: repoPath, env });
  assertSuccess(result);

  assert.deepEqual(
    run("git", ["log", "--format=%s", "origin/main..HEAD"], { cwd: repoPath })
      .split("\n")
      .filter(Boolean),
    ["fix: add follow-up changes"],
  );
  assert.equal(
    run("git", ["rev-parse", "HEAD"], { cwd: repoPath }),
    run("git", ["rev-parse", `origin/${featureBranch}`], { cwd: repoPath }),
  );
  assert.match(result.stdout, /Dropped empty "Initial plan" commit/);
});

test("exits cleanly when the PR does not contain an Initial plan commit", async (t) => {
  const { env, repoPath } = await setupRepository(t, [
    { type: "file", message: "fix: keep branch history clean", contents: "feature\n" },
  ]);
  const beforeHead = run("git", ["rev-parse", "HEAD"], { cwd: repoPath });

  const result = runResult("bash", [scriptPath], { cwd: repoPath, env });
  assertSuccess(result);

  assert.equal(run("git", ["rev-parse", "HEAD"], { cwd: repoPath }), beforeHead);
  assert.match(result.stdout, /Nothing to do/);
});

test("fails when multiple Initial plan commits are present in the PR range", async (t) => {
  const { env, repoPath } = await setupRepository(t, [
    { type: "empty", message: "Initial plan" },
    { type: "file", message: "fix: preserve context", contents: "context\n" },
    { type: "empty", message: "Initial plan" },
  ]);

  const result = runResult("bash", [scriptPath], { cwd: repoPath, env });

  assertFailure(result, /Found multiple "Initial plan" commits/);
});

test("fails when the Initial plan commit is not empty", async (t) => {
  const { env, repoPath } = await setupRepository(t, [
    { type: "file", message: "Initial plan", contents: "not empty\n" },
    { type: "file", message: "fix: follow-up change", contents: "follow-up\n" },
  ]);

  const result = runResult("bash", [scriptPath], { cwd: repoPath, env });

  assertFailure(result, /has subject "Initial plan" but is not empty/);
});

test("fails on a dirty worktree before rewriting history", async (t) => {
  const { env, repoPath } = await setupRepository(t, [
    { type: "empty", message: "Initial plan" },
    { type: "file", message: "fix: follow-up change", contents: "follow-up\n" },
  ]);

  await writeFile(path.join(repoPath, "dirty.txt"), "dirty\n");

  const result = runResult("bash", [scriptPath], { cwd: repoPath, env });

  assertFailure(result, /Worktree must be clean/);
});

test("fails when the current branch does not have PR context", async (t) => {
  const { env, repoPath } = await setupRepository(t, [
    { type: "empty", message: "Initial plan" },
    { type: "file", message: "fix: follow-up change", contents: "follow-up\n" },
  ]);

  const result = runResult("bash", [scriptPath], {
    cwd: repoPath,
    env: {
      ...env,
      GH_PR_VIEW_EXIT_CODE: "1",
    },
  });

  assertFailure(result, /Could not resolve the pull request base branch/);
});

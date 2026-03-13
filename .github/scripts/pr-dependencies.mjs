#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createGitHubClient, upsertLabel } from "./github-client.mjs";

export const DEPENDENTS_LABEL = "has-dependents";
export const DEPENDS_ON_PATTERN = /^depends-on:#(\d+)$/;
export const STACK_BRANCH_PATTERN = /^feat\//;
const DYNAMIC_DEPENDENCY_LABEL_COLOR = "bfd4f2";
const DYNAMIC_DEPENDENCY_LABEL_ATTACH_RETRY_DELAYS_MS = [250, 1000, 2000];

async function paginate(github, path) {
  const items = [];
  let page = 1;

  while (true) {
    const data = await github(
      `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
    );
    items.push(...data);

    if (data.length < 100) {
      return items;
    }

    page += 1;
  }
}

async function ensureLabels(github, owner, repo) {
  const labelsPath = new URL("../labels.json", import.meta.url);
  const labels = JSON.parse(await readFile(labelsPath, "utf8"));

  for (const label of labels) {
    await upsertLabel(github, owner, repo, label);
  }
}

function isMissingIssueLabelDelete(error) {
  return error?.status === 404 && error?.data?.message === "Label does not exist";
}

export async function toggleLabel(
  github,
  owner,
  repo,
  prNumber,
  labelsByName,
  labelName,
  shouldExist,
) {
  const hasLabel = labelsByName.has(labelName);

  if (shouldExist && !hasLabel) {
    await github(`/repos/${owner}/${repo}/issues/${prNumber}/labels`, {
      method: "POST",
      body: JSON.stringify({ labels: [labelName] }),
    });
    return;
  }

  if (!shouldExist && hasLabel) {
    // Delete handling stays local to this workflow instead of the shared GitHub
    // client because stack reconciliation intentionally mutates labels on related
    // PRs. Those cross-PR writes emit their own label events, which can trigger a
    // second reconciliation run with a fresher snapshot. If that newer run removes
    // the label first, this older run sees a 404 "Label does not exist" while
    // trying to reach the same final state. Treating only that delete miss as
    // success keeps label removal idempotent without hiding unrelated 404s.
    try {
      await github(
        `/repos/${owner}/${repo}/issues/${prNumber}/labels/${encodeURIComponent(labelName)}`,
        {
          method: "DELETE",
        },
      );
    } catch (error) {
      if (!isMissingIssueLabelDelete(error)) {
        throw error;
      }
    }
  }
}

async function ensureDynamicDependencyLabel(github, owner, repo, labelName) {
  return upsertLabel(github, owner, repo, {
    name: labelName,
    color: DYNAMIC_DEPENDENCY_LABEL_COLOR,
    description: "Automatically managed stacked PR dependency label.",
  });
}

export function isDependencyLabelFirstCreationRace(error, labelName) {
  if (error?.status !== 422 || !DEPENDS_ON_PATTERN.test(labelName)) {
    return false;
  }

  return (error.data?.errors ?? []).some(
    (detail) =>
      detail?.value === labelName &&
      detail?.resource === "Label" &&
      detail?.field === "name" &&
      detail?.code === "invalid",
  );
}

export async function addDependencyLabelWithRetry(
  github,
  owner,
  repo,
  prNumber,
  labelsByName,
  labelName,
  {
    retryDelaysMs = DYNAMIC_DEPENDENCY_LABEL_ATTACH_RETRY_DELAYS_MS,
  } = {},
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await toggleLabel(
        github,
        owner,
        repo,
        prNumber,
        labelsByName,
        labelName,
        true,
      );
      return;
    } catch (error) {
      const delayMs = retryDelaysMs[attempt];

      if (
        delayMs == null ||
        !isDependencyLabelFirstCreationRace(error, labelName)
      ) {
        throw error;
      }

      console.warn(
        `Retrying dependency label ${labelName} on PR #${prNumber} after ${delayMs}ms due to a suspected first-creation race.`,
      );
      await sleep(delayMs);
    }
  }
}

export function getDependencyLabelNames(pr) {
  return (pr.labels ?? [])
    .map((label) => label.name)
    .filter((name) => DEPENDS_ON_PATTERN.test(name));
}

function buildParentPullsByHeadRef(openPulls) {
  const parentPullsByHeadRef = new Map();

  for (const pr of openPulls) {
    const parentPulls = parentPullsByHeadRef.get(pr.head.ref) ?? [];
    parentPulls.push(pr);
    parentPullsByHeadRef.set(pr.head.ref, parentPulls);
  }

  return parentPullsByHeadRef;
}

export function resolveParentPull(childPr, parentPullsByHeadRef) {
  if (!STACK_BRANCH_PATTERN.test(childPr.base.ref)) {
    return null;
  }

  const candidates = (parentPullsByHeadRef.get(childPr.base.ref) ?? []).filter(
    (candidate) => candidate.number !== childPr.number,
  );

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length > 1) {
    console.warn(
      `Skipping dependency label for PR #${childPr.number}; base ${childPr.base.ref} maps to multiple open parent PRs.`,
    );
    return null;
  }

  return candidates[0];
}

export function computeDependencyUpdates(openPulls) {
  const parentPullsByHeadRef = buildParentPullsByHeadRef(openPulls);
  const desiredDependencyLabelByPrNumber = new Map();
  const childCountByParentPrNumber = new Map();

  for (const pr of openPulls) {
    const parentPr = resolveParentPull(pr, parentPullsByHeadRef);
    const dependencyLabelName = parentPr
      ? `depends-on:#${parentPr.number}`
      : null;

    if (dependencyLabelName) {
      desiredDependencyLabelByPrNumber.set(pr.number, dependencyLabelName);
      childCountByParentPrNumber.set(
        parentPr.number,
        (childCountByParentPrNumber.get(parentPr.number) ?? 0) + 1,
      );
    }
  }

  return openPulls.map((pr) => ({
    prNumber: pr.number,
    desiredDependencyLabel:
      desiredDependencyLabelByPrNumber.get(pr.number) ?? null,
    hasDependents: (childCountByParentPrNumber.get(pr.number) ?? 0) > 0,
  }));
}

export async function main({
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY,
} = {}) {
  if (!token) {
    throw new Error("GITHUB_TOKEN is required.");
  }

  if (!repository) {
    throw new Error("GITHUB_REPOSITORY is required.");
  }

  const [owner, repo] = repository.split("/");
  const github = createGitHubClient(token, "towncord-pr-dependencies");

  await ensureLabels(github, owner, repo);

  const openPulls = await paginate(
    github,
    `/repos/${owner}/${repo}/pulls?state=open`,
  );
  const dependencyUpdatesByPrNumber = new Map(
    computeDependencyUpdates(openPulls).map((update) => [
      update.prNumber,
      update,
    ]),
  );

  for (const pr of openPulls) {
    const labelsByName = new Set((pr.labels ?? []).map((label) => label.name));
    const existingDependencyLabels = getDependencyLabelNames(pr);
    const dependencyUpdate = dependencyUpdatesByPrNumber.get(pr.number);
    const desiredDependencyLabel =
      dependencyUpdate?.desiredDependencyLabel ?? null;

    for (const labelName of existingDependencyLabels) {
      if (labelName === desiredDependencyLabel) {
        continue;
      }

      await toggleLabel(
        github,
        owner,
        repo,
        pr.number,
        labelsByName,
        labelName,
        false,
      );
      labelsByName.delete(labelName);
    }

    if (desiredDependencyLabel) {
      const dependencyLabelState = await ensureDynamicDependencyLabel(
        github,
        owner,
        repo,
        desiredDependencyLabel,
      );

      if (dependencyLabelState === "created") {
        // GitHub can briefly reject a freshly created dynamic dependency label
        // as invalid when attaching it to the PR. See
        // specs/pr-dependency-label-first-creation-race.md.
        await addDependencyLabelWithRetry(
          github,
          owner,
          repo,
          pr.number,
          labelsByName,
          desiredDependencyLabel,
        );
      } else {
        await toggleLabel(
          github,
          owner,
          repo,
          pr.number,
          labelsByName,
          desiredDependencyLabel,
          true,
        );
      }
      labelsByName.add(desiredDependencyLabel);
    }

    const hasDependents = dependencyUpdate?.hasDependents ?? false;
    await toggleLabel(
      github,
      owner,
      repo,
      pr.number,
      labelsByName,
      DEPENDENTS_LABEL,
      hasDependents,
    );

    console.log(
      `Processed PR #${pr.number}: dependency=${desiredDependencyLabel ?? "none"}, hasDependents=${hasDependents}`,
    );
  }
}

const isDirectExecution =
  process.argv[1] &&
  resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  await main();
}

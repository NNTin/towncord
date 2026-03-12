#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const DEPENDENTS_LABEL = "has-dependents";
const DEPENDS_ON_PATTERN = /^depends-on:#(\d+)$/;
const STACK_BRANCH_PATTERN = /^feat\//;
const DYNAMIC_DEPENDENCY_LABEL_COLOR = "bfd4f2";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;

if (!token) {
  throw new Error("GITHUB_TOKEN is required.");
}

if (!repository) {
  throw new Error("GITHUB_REPOSITORY is required.");
}

const [owner, repo] = repository.split("/");

async function github(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "towncord-pr-dependencies",
      ...init.headers,
    },
  });

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message ?? response.statusText;
    const error = new Error(`${response.status} ${message}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function paginate(path) {
  const items = [];
  let page = 1;

  while (true) {
    const data = await github(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    items.push(...data);

    if (data.length < 100) {
      return items;
    }

    page += 1;
  }
}

async function ensureLabels() {
  const labelsPath = new URL("../labels.json", import.meta.url);
  const labels = JSON.parse(await readFile(labelsPath, "utf8"));

  for (const label of labels) {
    const encodedName = encodeURIComponent(label.name);
    let exists = false;

    try {
      await github(`/repos/${owner}/${repo}/labels/${encodedName}`);
      exists = true;
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
    }

    if (exists) {
      await github(`/repos/${owner}/${repo}/labels/${encodedName}`, {
        method: "PATCH",
        body: JSON.stringify(label),
      });
      continue;
    }

    await github(`/repos/${owner}/${repo}/labels`, {
      method: "POST",
      body: JSON.stringify(label),
    });
  }
}

async function toggleLabel(prNumber, labelsByName, labelName, shouldExist) {
  const hasLabel = labelsByName.has(labelName);

  if (shouldExist && !hasLabel) {
    await github(`/repos/${owner}/${repo}/issues/${prNumber}/labels`, {
      method: "POST",
      body: JSON.stringify({ labels: [labelName] }),
    });
    return;
  }

  if (!shouldExist && hasLabel) {
    await github(`/repos/${owner}/${repo}/issues/${prNumber}/labels/${encodeURIComponent(labelName)}`, {
      method: "DELETE",
    });
  }
}

async function ensureDynamicDependencyLabel(labelName) {
  const encodedName = encodeURIComponent(labelName);

  try {
    await github(`/repos/${owner}/${repo}/labels/${encodedName}`);
    return;
  } catch (error) {
    if (error.status !== 404) {
      throw error;
    }
  }

  await github(`/repos/${owner}/${repo}/labels`, {
    method: "POST",
    body: JSON.stringify({
      name: labelName,
      color: DYNAMIC_DEPENDENCY_LABEL_COLOR,
      description: "Automatically managed stacked PR dependency label.",
    }),
  });
}

function getDependencyLabelNames(pr) {
  return (pr.labels ?? [])
    .map((label) => label.name)
    .filter((name) => DEPENDS_ON_PATTERN.test(name));
}

function resolveParentPull(childPr, parentPullsByHeadRef, defaultBranch) {
  if (!STACK_BRANCH_PATTERN.test(childPr.base.ref)) {
    return null;
  }

  const candidates = (parentPullsByHeadRef.get(childPr.base.ref) ?? []).filter(
    (candidate) => candidate.number !== childPr.number,
  );

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  const defaultBranchCandidates = candidates.filter(
    (candidate) => candidate.base.ref === defaultBranch,
  );

  if (defaultBranchCandidates.length === 1) {
    return defaultBranchCandidates[0];
  }

  console.warn(
    `Skipping dependency label for PR #${childPr.number}; base ${childPr.base.ref} maps to multiple open parent PRs.`,
  );
  return null;
}

await ensureLabels();

const repositoryData = await github(`/repos/${owner}/${repo}`);
const defaultBranch = repositoryData.default_branch;
const openPulls = await paginate(`/repos/${owner}/${repo}/pulls?state=open`);
const parentPullsByHeadRef = new Map();

for (const pr of openPulls) {
  const parentPulls = parentPullsByHeadRef.get(pr.head.ref) ?? [];
  parentPulls.push(pr);
  parentPullsByHeadRef.set(pr.head.ref, parentPulls);
}

const desiredDependencyLabelByPrNumber = new Map();
const childCountByParentPrNumber = new Map();

for (const pr of openPulls) {
  const parentPr = resolveParentPull(pr, parentPullsByHeadRef, defaultBranch);
  const dependencyLabelName = parentPr ? `depends-on:#${parentPr.number}` : null;

  if (dependencyLabelName) {
    desiredDependencyLabelByPrNumber.set(pr.number, dependencyLabelName);
    childCountByParentPrNumber.set(
      parentPr.number,
      (childCountByParentPrNumber.get(parentPr.number) ?? 0) + 1,
    );
  }
}

for (const pr of openPulls) {
  const labelsByName = new Set((pr.labels ?? []).map((label) => label.name));
  const existingDependencyLabels = getDependencyLabelNames(pr);
  const desiredDependencyLabel = desiredDependencyLabelByPrNumber.get(pr.number) ?? null;

  for (const labelName of existingDependencyLabels) {
    if (labelName === desiredDependencyLabel) {
      continue;
    }

    await toggleLabel(pr.number, labelsByName, labelName, false);
    labelsByName.delete(labelName);
  }

  if (desiredDependencyLabel) {
    await ensureDynamicDependencyLabel(desiredDependencyLabel);
    await toggleLabel(pr.number, labelsByName, desiredDependencyLabel, true);
    labelsByName.add(desiredDependencyLabel);
  }

  const hasDependents = (childCountByParentPrNumber.get(pr.number) ?? 0) > 0;
  await toggleLabel(pr.number, labelsByName, DEPENDENTS_LABEL, hasDependents);

  console.log(
    `Processed PR #${pr.number}: dependency=${desiredDependencyLabel ?? "none"}, hasDependents=${hasDependents}`,
  );
}

#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const CHECK_NAME = "pr-dependencies";
const DEPENDENCY_LABEL = "dependency-blocked";
const DEPENDENTS_LABEL = "has-dependents";
const DEPENDS_ON_PATTERN = /^depends-on:#(\d+)$/;

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

function getDependencyNumbers(pr) {
  const dependencyNumbers = new Set();

  for (const label of pr.labels ?? []) {
    const match = DEPENDS_ON_PATTERN.exec(label.name);

    if (match) {
      dependencyNumbers.add(Number(match[1]));
    }
  }

  return [...dependencyNumbers];
}

function buildSummary(pr, explicitBlockers, childBlockers) {
  const lines = [
    `PR #${pr.number}: ${pr.title}`,
    "",
  ];

  if (explicitBlockers.length === 0 && childBlockers.length === 0) {
    lines.push("No open or unresolved dependencies were detected.");
    return {
      conclusion: "success",
      title: "Dependencies satisfied",
      summary: lines.join("\n"),
    };
  }

  lines.push("This pull request is blocked by dependency rules.");

  if (explicitBlockers.length > 0) {
    lines.push("");
    lines.push("Explicit dependencies:");
    for (const blocker of explicitBlockers) {
      lines.push(`- ${blocker}`);
    }
  }

  if (childBlockers.length > 0) {
    lines.push("");
    lines.push("Open child pull requests:");
    for (const blocker of childBlockers) {
      lines.push(`- ${blocker}`);
    }
  }

  return {
    conclusion: "failure",
    title: "Dependencies blocked",
    summary: lines.join("\n"),
  };
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

async function upsertCheckRun(pr, outcome) {
  const checkRuns = await github(
    `/repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs?check_name=${encodeURIComponent(CHECK_NAME)}`,
  );

  const existing = checkRuns.check_runs.find((checkRun) => checkRun.name === CHECK_NAME);
  const payload = {
    status: "completed",
    conclusion: outcome.conclusion,
    external_id: String(pr.number),
    output: {
      title: outcome.title,
      summary: outcome.summary,
    },
  };

  if (existing) {
    await github(`/repos/${owner}/${repo}/check-runs/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return;
  }

  await github(`/repos/${owner}/${repo}/check-runs`, {
    method: "POST",
    body: JSON.stringify({
      name: CHECK_NAME,
      head_sha: pr.head.sha,
      ...payload,
    }),
  });
}

await ensureLabels();

const openPulls = await paginate(`/repos/${owner}/${repo}/pulls?state=open`);
const childPullsByHeadRef = new Map();
const referencedDependencyNumbers = new Set();

for (const pr of openPulls) {
  const childPulls = childPullsByHeadRef.get(pr.base.ref) ?? [];
  childPulls.push(pr);
  childPullsByHeadRef.set(pr.base.ref, childPulls);

  for (const dependencyNumber of getDependencyNumbers(pr)) {
    referencedDependencyNumbers.add(dependencyNumber);
  }
}

const cachedPulls = new Map();

for (const pr of openPulls) {
  cachedPulls.set(pr.number, pr);
}

for (const dependencyNumber of referencedDependencyNumbers) {
  if (cachedPulls.has(dependencyNumber)) {
    continue;
  }

  try {
    const dependencyPr = await github(`/repos/${owner}/${repo}/pulls/${dependencyNumber}`);
    cachedPulls.set(dependencyNumber, dependencyPr);
  } catch (error) {
    if (error.status === 404) {
      cachedPulls.set(dependencyNumber, null);
      continue;
    }

    throw error;
  }
}

for (const pr of openPulls) {
  const labelsByName = new Set((pr.labels ?? []).map((label) => label.name));
  const explicitBlockers = [];
  const childBlockers = [];

  for (const dependencyNumber of getDependencyNumbers(pr)) {
    const dependencyPr = cachedPulls.get(dependencyNumber);

    if (dependencyPr === null) {
      explicitBlockers.push(`PR #${dependencyNumber} does not exist.`);
      continue;
    }

    if (dependencyPr?.state === "open") {
      explicitBlockers.push(
        `Waiting for PR #${dependencyPr.number} (${dependencyPr.head.ref} -> ${dependencyPr.base.ref}) to merge.`,
      );
      continue;
    }

    if (!dependencyPr?.merged_at) {
      explicitBlockers.push(`PR #${dependencyNumber} was closed without merging.`);
    }
  }

  const childPulls = (childPullsByHeadRef.get(pr.head.ref) ?? []).filter(
    (childPr) => childPr.number !== pr.number,
  );

  for (const childPr of childPulls) {
    childBlockers.push(
      `PR #${childPr.number} (${childPr.head.ref} -> ${childPr.base.ref}) still targets ${pr.head.ref}.`,
    );
  }

  const outcome = buildSummary(pr, explicitBlockers, childBlockers);

  await toggleLabel(pr.number, labelsByName, DEPENDENCY_LABEL, outcome.conclusion === "failure");
  await toggleLabel(pr.number, labelsByName, DEPENDENTS_LABEL, childPulls.length > 0);
  await upsertCheckRun(pr, outcome);

  console.log(
    `Processed PR #${pr.number}: ${outcome.conclusion} (${explicitBlockers.length} explicit blockers, ${childBlockers.length} child blockers)`,
  );
}

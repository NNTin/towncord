import assert from "node:assert/strict";
import test from "node:test";

import {
  addDependencyLabelWithRetry,
  computeDependencyUpdates,
  getDependencyLabelNames,
  isDependencyLabelFirstCreationRace,
  resolveParentPull,
} from "../pr-dependencies.mjs";

function createPr({ number, headRef, baseRef, labels = [] }) {
  return {
    number,
    head: { ref: headRef },
    base: { ref: baseRef },
    labels: labels.map((name) => ({ name })),
  };
}

test("resolveParentPull skips ambiguous parents even when one targets main", () => {
  const child = createPr({
    number: 30,
    headRef: "fix/branch-B",
    baseRef: "feat/branch-A",
  });
  const parentToMain = createPr({
    number: 10,
    headRef: "feat/branch-A",
    baseRef: "main",
  });
  const duplicateParent = createPr({
    number: 11,
    headRef: "feat/branch-A",
    baseRef: "release/next",
  });

  const parentPullsByHeadRef = new Map([["feat/branch-A", [parentToMain, duplicateParent]]]);

  const originalWarn = console.warn;

  console.warn = () => {};

  try {
    assert.equal(resolveParentPull(child, parentPullsByHeadRef), null);
  } finally {
    console.warn = originalWarn;
  }
});

test("computeDependencyUpdates assigns dependency and has-dependents for a simple stack", () => {
  const parent = createPr({
    number: 10,
    headRef: "feat/branch-A",
    baseRef: "main",
  });
  const child = createPr({
    number: 20,
    headRef: "fix/branch-B",
    baseRef: "feat/branch-A",
  });

  assert.deepEqual(computeDependencyUpdates([parent, child]), [
    {
      prNumber: 10,
      desiredDependencyLabel: null,
      hasDependents: true,
    },
    {
      prNumber: 20,
      desiredDependencyLabel: "depends-on:#10",
      hasDependents: false,
    },
  ]);
});

test("computeDependencyUpdates removes stack linkage when a child retargets to main", () => {
  const parent = createPr({
    number: 10,
    headRef: "feat/branch-A",
    baseRef: "main",
  });
  const retargetedChild = createPr({
    number: 20,
    headRef: "fix/branch-B",
    baseRef: "main",
    labels: ["depends-on:#10"],
  });

  assert.deepEqual(computeDependencyUpdates([parent, retargetedChild]), [
    {
      prNumber: 10,
      desiredDependencyLabel: null,
      hasDependents: false,
    },
    {
      prNumber: 20,
      desiredDependencyLabel: null,
      hasDependents: false,
    },
  ]);
});

test("getDependencyLabelNames returns only dependency labels", () => {
  const pr = createPr({
    number: 20,
    headRef: "fix/branch-B",
    baseRef: "feat/branch-A",
    labels: ["bug", "depends-on:#10", "frontend", "depends-on:#11"],
  });

  assert.deepEqual(getDependencyLabelNames(pr), ["depends-on:#10", "depends-on:#11"]);
});

test("isDependencyLabelFirstCreationRace matches the observed GitHub validation error", () => {
  const error = new Error("422 Validation Failed");
  error.status = 422;
  error.data = {
    errors: [
      {
        value: "depends-on:#10",
        resource: "Label",
        field: "name",
        code: "invalid",
      },
    ],
  };

  assert.equal(
    isDependencyLabelFirstCreationRace(error, "depends-on:#10"),
    true,
  );
  assert.equal(
    isDependencyLabelFirstCreationRace(error, "has-dependents"),
    false,
  );
});

test("addDependencyLabelWithRetry retries the observed first-creation race once", async () => {
  let callCount = 0;
  const originalWarn = console.warn;
  const github = async () => {
    callCount += 1;

    if (callCount === 1) {
      const error = new Error("422 Validation Failed");
      error.status = 422;
      error.data = {
        errors: [
          {
            value: "depends-on:#10",
            resource: "Label",
            field: "name",
            code: "invalid",
          },
        ],
      };
      throw error;
    }

    return null;
  };

  console.warn = () => {};

  try {
    await addDependencyLabelWithRetry(
      github,
      "owner",
      "repo",
      20,
      new Set(),
      "depends-on:#10",
      { retryDelaysMs: [0] },
    );
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(callCount, 2);
});

test("addDependencyLabelWithRetry does not retry unrelated failures", async () => {
  let callCount = 0;
  const github = async () => {
    callCount += 1;

    const error = new Error("403 Forbidden");
    error.status = 403;
    throw error;
  };

  await assert.rejects(
    addDependencyLabelWithRetry(
      github,
      "owner",
      "repo",
      20,
      new Set(),
      "depends-on:#10",
      { retryDelaysMs: [0] },
    ),
    { message: "403 Forbidden" },
  );

  assert.equal(callCount, 1);
});

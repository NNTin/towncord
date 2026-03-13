import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PR CI workflow reruns on edited pull requests", async () => {
  const workflowPath = new URL("../../workflows/ci.yml", import.meta.url);
  const workflowContents = await readFile(workflowPath, "utf8");

  assert.match(
    workflowContents,
    /pull_request:\n(?: {4}types:\n| {6}- .*\n)* {6}- edited\b/m,
  );
});

test("PR CI workflow checks duplicated code with jscpd", async () => {
  const workflowPath = new URL("../../workflows/ci.yml", import.meta.url);
  const workflowContents = await readFile(workflowPath, "utf8");

  assert.match(workflowContents, /run: npm run jscpd/);
});

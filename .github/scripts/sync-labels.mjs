#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createGitHubClient, upsertLabel } from "./github-client.mjs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;

if (!token) {
  throw new Error("GITHUB_TOKEN is required.");
}

if (!repository) {
  throw new Error("GITHUB_REPOSITORY is required.");
}

const [owner, repo] = repository.split("/");
const labelsPath = new URL("../labels.json", import.meta.url);
const labels = JSON.parse(await readFile(labelsPath, "utf8"));
const github = createGitHubClient(token, "towncord-label-sync");

for (const label of labels) {
  const result = await upsertLabel(github, owner, repo, label);
  console.log(
    `${result === "created" ? "Created" : "Updated"} label: ${label.name}`,
  );
}

#!/usr/bin/env node

import { readFile } from "node:fs/promises";

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

async function github(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "towncord-label-sync",
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

async function upsertLabel(label) {
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
    console.log(`Updated label: ${label.name}`);
    return;
  }

  await github(`/repos/${owner}/${repo}/labels`, {
    method: "POST",
    body: JSON.stringify(label),
  });
  console.log(`Created label: ${label.name}`);
}

for (const label of labels) {
  await upsertLabel(label);
}

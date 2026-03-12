export function createGitHubClient(token, userAgent) {
  return async function github(path, init = {}) {
    const response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": userAgent,
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
  };
}

export async function upsertLabel(github, owner, repo, label) {
  const encodedName = encodeURIComponent(label.name);

  try {
    await github(`/repos/${owner}/${repo}/labels/${encodedName}`);
    await github(`/repos/${owner}/${repo}/labels/${encodedName}`, {
      method: "PATCH",
      body: JSON.stringify(label),
    });
    return "updated";
  } catch (error) {
    if (error.status !== 404) {
      throw error;
    }
  }

  await github(`/repos/${owner}/${repo}/labels`, {
    method: "POST",
    body: JSON.stringify(label),
  });
  return "created";
}

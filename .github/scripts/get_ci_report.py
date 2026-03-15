#!/usr/bin/env python3
"""Fetch the CI report comment from a GitHub PR.

Usage:
    python3 get_ci_report.py <pr_number> [--repo owner/repo]

Exit codes:
    0  — CI report found; content printed to stdout
    1  — no CI report comment exists on that PR
    2  — gh CLI error or bad arguments
    3  — CI pipeline is currently in progress; retry later
"""

import argparse
import json
import subprocess
import sys

MARKER = "<!-- ci-report -->"
WORKFLOW_NAME = "PR CI"


def gh_api(path: str, *, paginate: bool = False, jq: str | None = None) -> object:
    """Call `gh api` and return parsed JSON. Exits with code 2 on failure."""
    cmd = ["gh", "api", path]
    if paginate:
        cmd.append("--paginate")
    if jq:
        cmd += ["--jq", jq]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"error: gh API call failed for {path}\n{result.stderr.strip()}", file=sys.stderr)
        sys.exit(2)
    raw = result.stdout.strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        print(f"error: unexpected response from gh API\n{raw}", file=sys.stderr)
        sys.exit(2)


def detect_repo() -> str:
    result = subprocess.run(
        ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("error: could not detect repo — pass --repo owner/repo", file=sys.stderr)
        sys.exit(2)
    return result.stdout.strip()


# ── in-progress detection ─────────────────────────────────────────────────────


def find_in_progress_run(repo: str, pr_number: int) -> dict | None:
    """Return the in-progress CI workflow run for this PR, or None."""
    data = gh_api(f"repos/{repo}/actions/runs?event=pull_request&per_page=20")
    if not data:
        return None
    for run in data.get("workflow_runs", []):
        if run.get("name") != WORKFLOW_NAME:
            continue
        if run.get("status") != "in_progress":
            continue
        pr_numbers = [pr["number"] for pr in run.get("pull_requests", [])]
        if pr_number in pr_numbers:
            return run
    return None


def find_current_step(repo: str, run_id: int) -> str | None:
    """Return the name of the currently running step, or None."""
    data = gh_api(f"repos/{repo}/actions/runs/{run_id}/jobs")
    if not data:
        return None
    for job in data.get("jobs", []):
        if job.get("status") != "in_progress":
            continue
        for step in job.get("steps", []):
            if step.get("status") == "in_progress":
                return step.get("name")
    return None


def check_in_progress_run(repo: str, pr_number: int) -> None:
    """If a CI run is in progress, print status and exit 3."""
    run = find_in_progress_run(repo, pr_number)
    if run is None:
        return

    run_id = run["id"]
    run_url = run.get("html_url", "")
    current_step = find_current_step(repo, run_id)

    print(f"CI pipeline in progress for PR #{pr_number}")
    if current_step:
        print(f"Current step: {current_step}")
    print(run_url)
    sys.exit(3)


# ── comment fetching ──────────────────────────────────────────────────────────


def fetch_ci_comment(repo: str, pr_number: int) -> str | None:
    data = gh_api(
        f"repos/{repo}/issues/{pr_number}/comments",
        paginate=True,
        jq=f'[.[] | select(.body | contains("{MARKER}"))] | first',
    )
    if not data or data == "null":
        return None
    if isinstance(data, dict):
        return data.get("body", "")
    return None


def strip_marker(body: str) -> str:
    lines = body.splitlines()
    cleaned = [l for l in lines if l.strip() != MARKER]
    while cleaned and cleaned[0].strip() == "":
        cleaned.pop(0)
    return "\n".join(cleaned)


# ── entry point ───────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch the CI report comment from a GitHub PR."
    )
    parser.add_argument("pr_number", type=int, help="Pull request number")
    parser.add_argument(
        "--repo",
        help="Repository in owner/repo format (default: auto-detected from git remote)",
    )
    args = parser.parse_args()

    repo = args.repo or detect_repo()

    check_in_progress_run(repo, args.pr_number)

    body = fetch_ci_comment(repo, args.pr_number)
    if body is None:
        print(f"No CI report found for PR #{args.pr_number}", file=sys.stderr)
        sys.exit(1)

    print(strip_marker(body))


if __name__ == "__main__":
    main()

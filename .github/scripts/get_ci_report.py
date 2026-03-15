#!/usr/bin/env python3
"""Fetch the CI report comment from a GitHub PR.

Usage:
    python3 get_ci_report.py <pr_number> [--repo owner/repo]

Exit codes:
    0  — CI report found; content printed to stdout
    1  — no CI report comment exists on that PR
    2  — gh CLI error or bad arguments
"""

import argparse
import json
import subprocess
import sys

MARKER = "<!-- ci-report -->"


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


def fetch_ci_comment(repo: str, pr_number: str) -> str | None:
    result = subprocess.run(
        [
            "gh", "api",
            f"repos/{repo}/issues/{pr_number}/comments",
            "--paginate",
            "--jq", f'[.[] | select(.body | contains("{MARKER}"))] | first',
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"error: gh API call failed\n{result.stderr.strip()}", file=sys.stderr)
        sys.exit(2)

    raw = result.stdout.strip()
    if not raw or raw == "null":
        return None

    try:
        comment = json.loads(raw)
        return comment.get("body", "")
    except json.JSONDecodeError:
        print(f"error: unexpected response from gh API\n{raw}", file=sys.stderr)
        sys.exit(2)


def strip_marker(body: str) -> str:
    lines = body.splitlines()
    cleaned = [l for l in lines if l.strip() != MARKER]
    # Drop a leading blank line that may remain after removing the marker
    while cleaned and cleaned[0].strip() == "":
        cleaned.pop(0)
    return "\n".join(cleaned)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch the CI report comment from a GitHub PR."
    )
    parser.add_argument("pr_number", help="Pull request number")
    parser.add_argument(
        "--repo",
        help="Repository in owner/repo format (default: auto-detected from git remote)",
    )
    args = parser.parse_args()

    repo = args.repo or detect_repo()
    body = fetch_ci_comment(repo, args.pr_number)

    if body is None:
        print(f"No CI report found for PR #{args.pr_number}", file=sys.stderr)
        sys.exit(1)

    print(strip_marker(body))


if __name__ == "__main__":
    main()

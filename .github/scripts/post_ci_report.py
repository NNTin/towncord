#!/usr/bin/env python3
"""Post or update a CI report comment on a GitHub PR."""

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

MARKER = "<!-- ci-report -->"

STEP_ORDER = ["knip", "jscpd", "typecheck", "tests", "build"]

STEP_LABELS = {
    "knip": "unused deps/exports/files",
    "jscpd": "duplicated code",
    "typecheck": "typecheck",
    "tests": "frontend tests",
    "build": "build",
}

LOG_FILES = {
    "knip": "/tmp/knip.log",
    "jscpd": "/tmp/jscpd.log",
    "typecheck": "/tmp/typecheck.log",
    "tests": "/tmp/tests.log",
    "build": "/tmp/build.log",
}

ANSI_ESCAPE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
MAX_DETAIL_CHARS = 60000


# ── helpers ──────────────────────────────────────────────────────────────────


def strip_ansi(text: str) -> str:
    return ANSI_ESCAPE.sub("", text)


def sanitize_detail(detail: str) -> str:
    """Escape backticks and truncate overly large log detail for Markdown safety."""
    if not detail:
        return ""

    # Prevent raw triple backticks from breaking the surrounding code fence.
    safe = detail.replace("```", "`\u200b``")

    if len(safe) <= MAX_DETAIL_CHARS:
        return safe

    # Keep head and tail with a clear truncation marker in the middle.
    head_chars = MAX_DETAIL_CHARS // 2
    tail_chars = MAX_DETAIL_CHARS - head_chars
    head = safe[:head_chars]
    tail = safe[-tail_chars:]
    return (
        f"{head}\n\n"
        "…\n\n"
        "[log truncated; showing head and tail]\n\n"
        f"{tail}"
    )


def read_log(step: str) -> str:
    try:
        with open(LOG_FILES[step]) as fh:
            return strip_ansi(fh.read())
    except FileNotFoundError:
        return ""


def outcome_emoji(outcome: str) -> str:
    return {"success": "✅", "failure": "❌", "skipped": "⏭️"}.get(outcome, "⏭️")


def skip_npm_boilerplate(lines: list[str]) -> list[str]:
    """Drop leading npm ">" header lines and leading blank lines."""
    result = []
    started = False
    for line in lines:
        if not started:
            if line.startswith(">") or line.strip() == "":
                continue
            started = True
        result.append(line)
    return result


# ── per-tool extraction ───────────────────────────────────────────────────────


def extract_knip(log: str) -> tuple[str, str]:
    lines = skip_npm_boilerplate(log.splitlines())

    # Drop npm error/warn footer lines
    content_lines = [
        l for l in lines if not l.startswith("npm error") and not l.startswith("npm warn")
    ]
    content = "\n".join(content_lines).strip()

    # Build summary from "Unused X (N)" headings
    counts = [
        f"{m.group(2)} {m.group(1).lower()}"
        for m in re.finditer(r"Unused ([\w ]+?) \((\d+)\)", content)
    ]
    suffix = ", ".join(counts) if counts else "issues found"
    return suffix, content


def extract_jscpd(log: str) -> tuple[str, str]:
    lines = skip_npm_boilerplate(log.splitlines())

    # Collect Clone found blocks and the "Found N clones." summary; skip table rows
    table_chars = set("┌├│└┐┤┘┼─")
    clone_lines: list[str] = []
    in_clone_block = False

    for line in lines:
        if line and line[0] in table_chars:
            continue
        if line.startswith("Clone found"):
            in_clone_block = True
        if in_clone_block or line.startswith("Found ") or line.startswith("ERROR:"):
            clone_lines.append(line)
        if in_clone_block and line.strip() == "":
            in_clone_block = False

    content = "\n".join(clone_lines).strip()

    # Summary suffix
    count_match = re.search(r"Found (\d+) clones", content)
    threshold_match = re.search(
        r"found too many duplicates \(([0-9.]+%)\) over threshold \(([0-9.]+%)\)", content
    )
    count = count_match.group(1) if count_match else "?"
    if threshold_match:
        suffix = f"{count} clones ({threshold_match.group(1)} > {threshold_match.group(2)} threshold)"
    else:
        suffix = f"{count} clones found"

    return suffix, content


def extract_typecheck(log: str) -> tuple[str, str]:
    lines = log.splitlines()
    error_lines = [l for l in lines if "error TS" in l]
    count = len(error_lines)
    suffix = f"{count} error{'s' if count != 1 else ''}"
    return suffix, "\n".join(error_lines).strip()


def extract_tests(log: str) -> tuple[str, str]:
    lines = log.splitlines()

    # Find the "Failed Suites" divider
    start_idx = next(
        (i for i, l in enumerate(lines) if re.search(r"Failed Suites", l)), None
    )
    # Find the "Duration" line as the natural end of the vitest output
    end_idx = next(
        (i for i, l in enumerate(lines) if l.strip().startswith("Duration ")), None
    )

    if start_idx is not None:
        end = (end_idx + 1) if end_idx is not None else len(lines)
        content = "\n".join(lines[start_idx:end]).strip()
    else:
        fail_lines = [l for l in lines if l.strip().startswith("FAIL ")]
        content = "\n".join(fail_lines).strip()

    # Summary count from vitest summary line
    count_match = re.search(r"Test Files\s+(\d+) failed", "\n".join(lines))
    count = count_match.group(1) if count_match else "?"
    suffix = f"{count} failing suite{'s' if count != '1' else ''}"

    return suffix, content


def extract_build(log: str) -> tuple[str, str]:
    lines = log.splitlines()
    error_lines = [
        l
        for l in lines
        if "error TS" in l
        or (re.search(r"\berror\b", l, re.IGNORECASE) and "npm error" not in l)
    ]
    if not error_lines:
        error_lines = lines[-30:]
    count = len(error_lines)
    suffix = f"{count} error{'s' if count != 1 else ''}"
    return suffix, "\n".join(error_lines).strip()


EXTRACTORS = {
    "knip": extract_knip,
    "jscpd": extract_jscpd,
    "typecheck": extract_typecheck,
    "tests": extract_tests,
    "build": extract_build,
}


# ── comment composition ───────────────────────────────────────────────────────


def compose_comment(outcomes: dict[str, str], run_url: str) -> str:
    any_failure = any(v == "failure" for v in outcomes.values())
    overall = "❌" if any_failure else "✅"

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    parts = [
        MARKER,
        f"## CI Report {overall}  ·  [View run →]({run_url})  ·  *{timestamp}*",
        "",
        "| Check | Status |",
        "|-------|--------|",
    ]
    for step in STEP_ORDER:
        outcome = outcomes.get(step, "skipped")
        parts.append(f"| {STEP_LABELS[step]} | {outcome_emoji(outcome)} |")
    parts.append("")

    for step in STEP_ORDER:
        if outcomes.get(step) != "failure":
            continue
        log = read_log(step)
        suffix, detail = EXTRACTORS[step](log)
        label = STEP_LABELS[step]
        safe_detail = sanitize_detail(detail)
        parts += [
            "<details>",
            f"<summary><b>{label}</b> — {suffix}</summary>",
            "",
            "```",
            safe_detail,
            "```",
            "",
            "</details>",
            "",
        ]

    return "\n".join(parts)


# ── GitHub API ────────────────────────────────────────────────────────────────


def find_existing_comment(repo: str, pr_number: str) -> int | None:
    result = subprocess.run(
        [
            "gh", "api",
            f"repos/{repo}/issues/{pr_number}/comments",
            "--jq",
            f'[.[] | select(.body | contains("{MARKER}")) | .id] | first',
        ],
        capture_output=True,
        text=True,
    )
    val = result.stdout.strip()
    return int(val) if val and val != "null" else None


def post_comment(repo: str, pr_number: str, body: str) -> None:
    existing_id = find_existing_comment(repo, pr_number)
    payload = json.dumps({"body": body})

    if existing_id:
        url = f"repos/{repo}/issues/comments/{existing_id}"
        subprocess.run(
            ["gh", "api", url, "-X", "PATCH", "--input", "-"],
            input=payload,
            text=True,
            check=True,
        )
        print(f"Updated existing comment {existing_id}")
    else:
        url = f"repos/{repo}/issues/{pr_number}/comments"
        subprocess.run(
            ["gh", "api", url, "--input", "-"],
            input=payload,
            text=True,
            check=True,
        )
        print("Created new comment")


# ── entry point ───────────────────────────────────────────────────────────────


def main() -> None:
    outcomes = {
        step: os.environ.get(f"{step.upper()}_OUTCOME", "skipped")
        for step in STEP_ORDER
    }
    run_url = os.environ["RUN_URL"]
    pr_number = os.environ["PR_NUMBER"]
    repo = os.environ["REPO"]

    if not any(v == "failure" for v in outcomes.values()):
        print("All checks passed — no comment needed")
        return

    comment = compose_comment(outcomes, run_url)
    post_comment(repo, pr_number, comment)


if __name__ == "__main__":
    main()

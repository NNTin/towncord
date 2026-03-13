#!/usr/bin/env bash

set -euo pipefail

readonly TARGET_SUBJECT="Initial plan"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  fail "This script must be run inside a git repository."
fi

if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  fail "Worktree must be clean before rewriting history."
fi

current_branch="$(git symbolic-ref --quiet --short HEAD)" || fail "Current HEAD is detached."
upstream_remote="$(git config --get "branch.${current_branch}.remote")" || fail "Current branch has no upstream remote."
upstream_merge_ref="$(git config --get "branch.${current_branch}.merge")" || fail "Current branch has no upstream branch."

if [[ "$upstream_merge_ref" != refs/heads/* ]]; then
  fail "Unsupported upstream ref: ${upstream_merge_ref}"
fi

upstream_branch="${upstream_merge_ref#refs/heads/}"

command -v gh >/dev/null 2>&1 || fail "GitHub CLI (gh) is required."
gh auth status >/dev/null 2>&1 || fail "GitHub CLI is not authenticated."

pr_base_ref="$(gh pr view --json baseRefName --jq '.baseRefName')" || fail "Could not resolve the pull request base branch for ${current_branch}."

if [[ -z "$pr_base_ref" ]]; then
  fail "Pull request base branch is empty."
fi

base_tracking_ref="refs/remotes/${upstream_remote}/${pr_base_ref}"
git fetch --quiet "$upstream_remote" "refs/heads/${pr_base_ref}:${base_tracking_ref}"

commit_range="${base_tracking_ref}..HEAD"
mapfile -t candidate_commits < <(
  git log --format='%H%x09%s' "$commit_range" | awk -F '\t' -v subject="$TARGET_SUBJECT" '$2 == subject { print $1 }'
)

case "${#candidate_commits[@]}" in
  0)
    echo "No \"${TARGET_SUBJECT}\" commit found in ${commit_range}. Nothing to do."
    exit 0
    ;;
  1)
    ;;
  *)
    fail "Found multiple \"${TARGET_SUBJECT}\" commits in ${commit_range}; refusing to rewrite history."
    ;;
esac

candidate_commit="${candidate_commits[0]}"
parent_line="$(git rev-list --parents -n 1 "$candidate_commit")"
read -r -a parent_parts <<<"$parent_line"

if [[ "${#parent_parts[@]}" -ne 2 ]]; then
  fail "Commit ${candidate_commit} must be a non-merge commit with exactly one parent."
fi

candidate_tree="$(git rev-parse "${candidate_commit}^{tree}")"
parent_tree="$(git rev-parse "${candidate_commit}^1^{tree}")"

if [[ "$candidate_tree" != "$parent_tree" ]]; then
  fail "Commit ${candidate_commit} has subject \"${TARGET_SUBJECT}\" but is not empty."
fi

if ! git rebase --onto "${candidate_commit}^" "${candidate_commit}"; then
  git rebase --abort >/dev/null 2>&1 || true
  fail "Failed to drop commit ${candidate_commit}."
fi

git push --force-with-lease "$upstream_remote" "HEAD:${upstream_branch}"

echo "Dropped empty \"${TARGET_SUBJECT}\" commit ${candidate_commit} and force-pushed ${upstream_remote}/${upstream_branch}."

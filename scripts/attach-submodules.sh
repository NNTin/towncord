#!/bin/sh
# Attaches each submodule to a local branch named after the parent repo's current branch,
# pointing at the pinned commit recorded in the parent index.
set -e

PARENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$PARENT_BRANCH" = "HEAD" ]; then
  echo "attach-submodules: parent repo is in detached HEAD — skipping branch attachment"
  exit 0
fi

git submodule foreach --quiet '
  branch="'"$PARENT_BRANCH"'"
  git checkout -B "$branch"
  echo "  $name: attached to branch $branch at $(git rev-parse --short HEAD)"
'

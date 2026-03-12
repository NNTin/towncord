# `.worktree/`

This directory is reserved for Git worktrees created by humans or LLM agents.

## Purpose

Use `.worktree/` to run multiple feature branches in parallel without disturbing the main checkout at the repository root.

- The repository root is the base/reference checkout.
- Active feature work should happen inside a linked worktree under `.worktree/`, not in the repository root checkout.
- Each subdirectory inside `.worktree/` is a separate linked Git worktree.
- Agents may create new worktrees here as needed for isolated feature work.
- Worktrees are temporary. Remove them after the branch is merged or no longer needed.

## Required Workflow

For any implementation task on a branch, agents must create or enter a worktree before doing substantive work.

- Do not edit files, install dependencies, run feature-specific commands, commit, or push from the repository root checkout.
- Use the repository root checkout only to determine the current base branch and to open the parent-repo pull request after the worktree branch is pushed.
- If a user tells you to read or follow this README, treat these instructions as required workflow, not optional guidance.
- If you accidentally start in the repository root checkout, stop, create or enter the correct worktree, clean up the root checkout, and continue only inside the worktree.

## Naming

Use short, descriptive names so concurrent work is easy to identify.

Examples:

- `.worktree/feat-inventory-ui`
- `.worktree/fix-auth-timeout`
- `.worktree/agent-npc-pathfinding`

## Create A Worktree

Start every implementation task with this sequence:

1. From the repository root checkout, determine the base branch.
2. Create the worktree inside `.worktree/`.
3. `cd` into the new worktree before installing dependencies, editing files, or running task-specific commands.
4. Initialize submodules inside the worktree.
5. Confirm your current working directory is the worktree, not the repository root.

Create a new branch from the branch currently checked out at the repository root:

```bash
BASE_BRANCH=$(git branch --show-current)
git worktree add -b feat/my-change .worktree/feat-my-change "$BASE_BRANCH"
```

Create a worktree for an existing branch:

```bash
git worktree add .worktree/feat-my-change feat/my-change
```

Create a detached worktree for investigation or review:

```bash
git worktree add --detach .worktree/review-issue-123 HEAD
```

Initialize submodules inside the new worktree:

```bash
cd .worktree/feat-my-change
git submodule update --init --recursive
```

If you will modify code inside a submodule, create or switch to a branch inside that submodule before making changes:

```bash
git -C packages/debug-assets switch -c feat/my-change
```

If the submodule branch already exists:

```bash
git -C packages/debug-assets switch feat/my-change
```

## Agent Guidance

- Create worktrees only inside `.worktree/`.
- Prefer one branch per worktree.
- Create the worktree from the branch currently checked out at the repository root.
- After creating or entering a worktree, initialize submodules with `git submodule update --init --recursive`.
- Do not do branch implementation work in the repository root checkout.
- Do not run `npm install`, `npm ci`, file edits, commits, or pushes for branch work from the repository root checkout.
- Before editing a submodule, create or switch to a branch inside that submodule.
- If submodule code changes, push the submodule branch before pushing the parent worktree branch.
- When working inside `.worktree/`, agents should commit their changes and push the worktree branch automatically.
- After pushing the worktree branch, create a parent-repo pull request with `gh` from the worktree branch to the branch currently checked out at the repository root outside `.worktree/`.
- Do not store notes, artifacts, or unrelated files in `.worktree/`.
- Assume `.worktree/` contents are disposable except for this README.
- Coordinate branch names clearly when multiple agents are active.

## If You Started In The Wrong Place

If you already began work in the repository root checkout by mistake:

1. Stop making changes in the repository root checkout.
2. Inspect the root checkout with `git status`.
3. Create the correct worktree from the branch currently checked out at the repository root.
4. `cd` into the worktree and initialize submodules.
5. Reapply or continue the intended work inside the worktree only.
6. Restore the repository root checkout to a clean state if the accidental changes were not meant to stay there.

## Finish Work And Open A PR

Required close-out sequence:

1. Inside the worktree, push every changed submodule branch first.
2. Commit the parent repository changes in the worktree, including updated submodule pointers, and push the worktree branch.
3. From the repository root checkout outside `.worktree/`, create the parent-repo pull request against the branch currently checked out there.

Inside the worktree, push every changed submodule branch first:

```bash
git -C packages/debug-assets push -u origin HEAD
```

Then commit the parent repository changes, including updated submodule pointers, and push the worktree branch:

```bash
git push -u origin feat/my-change
```

From the repository root checkout outside `.worktree/`, create the parent-repo pull request against the branch currently checked out there:

```bash
cd /path/to/repository/root
BASE_BRANCH=$(git branch --show-current)
gh pr create --base "$BASE_BRANCH" --head feat/my-change
```

## Remove A Worktree

When the branch is merged or abandoned, remove the linked worktree:

```bash
git worktree remove .worktree/feat-my-change
```

If the branch is no longer needed locally:

```bash
git branch -d feat/my-change
```

## Notes

- `.worktree/README.md` is tracked on purpose.
- Other contents under `.worktree/` are ignored by Git.

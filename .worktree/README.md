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
- If a user or coordinating agent assigns you a specific worktree path or branch, use that exact worktree and branch. Do not switch to a different branch or worktree unless explicitly reassigned.
- Before editing files, installing dependencies, running tests, committing, or pushing, verify both `pwd` and `git branch --show-current` and confirm they match the assigned worktree and branch.
- If the assigned worktree or branch does not exist, create exactly that worktree and branch. Do not create an alternative name unless explicitly approved.

## Branch Isolation

Every implementation agent owns exactly one branch and one worktree unless explicitly told otherwise.

- Stay inside your assigned worktree for the entire task.
- Commit only to your assigned branch.
- Do not "help" by committing to an integration branch, another agent's branch, or the repository root checkout.
- Do not merge, rebase, or cherry-pick other branches into your branch unless the user or coordinating agent explicitly assigns that integration work to you.
- If you discover that another branch already contains overlapping work, stop and report it instead of redirecting your own work there.
- If you need read-only context from another branch, inspect it without changing your current branch or worktree.

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

Only if you will modify files inside a submodule, create or switch to a branch inside that submodule before making changes:

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
- After entering the worktree, verify `pwd` and `git branch --show-current` before doing any substantive work.
- Do not do branch implementation work in the repository root checkout.
- Do not run `npm install`, `npm ci`, file edits, commits, or pushes for branch work from the repository root checkout.
- Do not create submodule branches as part of routine worktree setup.
- Create or switch to a branch inside a submodule only when you will actually change files in that submodule.
- If submodule code changes, push the submodule branch before pushing the parent worktree branch.
- When working inside `.worktree/`, agents should commit their changes and push the worktree branch automatically.
- Do not switch your worktree to a different branch after setup. If the assigned branch is wrong, stop and ask for reassignment.
- After pushing the worktree branch, create a parent-repo pull request with `gh` from the worktree branch to the branch currently checked out at the repository root outside `.worktree/`.
- Do not store notes, artifacts, or unrelated files in `.worktree/`.
- Assume `.worktree/` contents are disposable except for this README.
- Coordinate branch names clearly when multiple agents are active.

## Merge Strategy

When combining work across feature branches, the merge strategy is merge only.

- Use `git merge`.
- Do not use squash merges.
- Do not use rebases to combine feature branches.
- Do not rewrite published branch history to make branches "cleaner".
- Preserve each worker branch's commit history when integrating.

If a dedicated integration branch is used:

1. Create or enter the integration worktree.
2. Merge each completed feature branch into the integration branch with a regular merge commit.
3. Resolve conflicts in the integration branch only.
4. Push the integration branch.

Example:

```bash
git switch feat/integration-branch
git merge --no-ff feat/worker-a
git merge --no-ff feat/worker-b
git merge --no-ff feat/worker-c
git push -u origin feat/integration-branch
```

Do not squash worker branches into the integration branch. Do not rebase worker branches onto the integration branch as a substitute for merging.

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

If multiple feature branches are being combined before the final PR:

1. Push each worker branch from its own worktree.
2. Enter the dedicated integration worktree.
3. Merge worker branches into the integration branch with regular merge commits.
4. Push the integration branch.
5. Open the PR from the integration branch.

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

## Check CI After Opening A PR

After creating a PR and pushing to GitHub, wait 10 seconds for the CI pipeline to register, then check the CI report:

```bash
sleep 10 && python3 .github/scripts/get_ci_report.py <PR number>
```

Exit codes:
- `0` — CI report ready; content printed to stdout
- `1` — no CI report yet (pipeline may not have run or all checks passed without failures)
- `2` — error (check stderr)
- `3` — pipeline is still in progress; wait and retry

If exit code `3` is returned, the current step is printed. Wait and retry until exit code `0` or `1`.

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

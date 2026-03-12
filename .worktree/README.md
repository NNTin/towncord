# `.worktree/`

This directory is reserved for Git worktrees created by humans or LLM agents.

## Purpose

Use `.worktree/` to run multiple feature branches in parallel without disturbing the main checkout at the repository root.

- The repository root remains the primary checkout.
- Each subdirectory inside `.worktree/` is a separate linked Git worktree.
- Agents may create new worktrees here as needed for isolated feature work.
- Worktrees are temporary. Remove them after the branch is merged or no longer needed.

## Naming

Use short, descriptive names so concurrent work is easy to identify.

Examples:

- `.worktree/feat-inventory-ui`
- `.worktree/fix-auth-timeout`
- `.worktree/agent-npc-pathfinding`

## Create A Worktree

Create a new branch from `main`:

```bash
git worktree add -b feat/my-change .worktree/feat-my-change main
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

## Agent Guidance

- Create worktrees only inside `.worktree/`.
- Prefer one branch per worktree.
- After creating or entering a worktree, initialize submodules with `git submodule update --init --recursive`.
- When working inside `.worktree/`, agents should commit their changes and push the worktree branch automatically.
- Do not store notes, artifacts, or unrelated files in `.worktree/`.
- Assume `.worktree/` contents are disposable except for this README.
- Coordinate branch names clearly when multiple agents are active.

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

# Copilot Instructions

## Project overview

Towncord is a browser-based multiplayer game built with [Phaser](https://phaser.io/) and React. The monorepo uses npm workspaces with:

- `apps/frontend` – the browser game (Phaser + React, bundled with Vite)
- `packages/public-assets` – exported sprite sheets and animation manifests (git submodule)
- `packages/public-animation-contracts` – TypeScript types and a generated AJV standalone validator for `public-assets` animation manifests
- `packages/bloomseed-assets`, `packages/debug-assets`, `packages/donarg-office-assets` – art asset submodules

## Conventions

- **Conventional Commits**: All commit messages must follow `type(scope): message` format (e.g. `feat:`, `fix:`, `refactor:`, `docs:`). If Copilot creates its automatic empty `Initial plan` commit while opening a PR, treat it as a temporary exception and remove it immediately after PR creation so the final branch history only contains conventional commits.
- **PR cleanup**: After creating a PR, run `bash .github/scripts/drop-empty-initial-plan-commit.sh`. If it reports an error, stop and surface the failure instead of continuing. If it removes a commit, let it force-push the branch with `--force-with-lease`.
- **TypeScript**: Use strict mode. Prefer `import type` for type-only imports. `moduleResolution` is `Bundler` in the frontend tsconfig.
- **ESM**: All packages use `"type": "module"`.
- **Testing**: Use [Vitest](https://vitest.dev/) (`vitest run`). Tests live in `__tests__/` directories alongside source files.
- **No AJV in the browser bundle**: The `@towncord/public-animation-contracts` package generates a self-contained AJV standalone validator (`validatePublicAnimations.generated.js`) at build time. AJV itself stays in `devDependencies` and is never imported at runtime by the frontend.

## Generated files

The following files are generated and gitignored:

- `packages/public-animation-contracts/src/publicAnimations.generated.ts`
- `packages/public-animation-contracts/src/validatePublicAnimations.generated.js`
- `packages/public-animation-contracts/src/validatePublicAnimations.generated.d.ts`

Regenerate them with:

```bash
npm run -w @towncord/public-animation-contracts generate
```

## Asset pipeline

Asset exports (`assets:public`) are orchestrated **only** from the root `package.json` scripts (e.g. `npm run dev:frontend`, `npm run build:frontend`). The frontend workspace scripts (`dev`, `build`) assume assets have already been exported and only run `contracts:generate`.

## Common commands

```bash
# Install dependencies (also runs contracts:generate via postinstall)
npm install

# Dev server
npm run dev:frontend

# Production build
npm run build:frontend

# Typecheck
npm run typecheck:frontend

# Tests
npm -w @towncord/frontend test

# Regenerate public animation contracts
npm run -w @towncord/public-animation-contracts generate
```

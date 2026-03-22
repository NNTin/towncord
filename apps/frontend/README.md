# Frontend Architecture

This app will use:

- React 18+
- Vite
- TypeScript in strict mode
- Phaser 3 for rendering/gameplay scenes

## Folder Structure

```text
apps/frontend/
  public/
    assets/
      bloomseed/
        pack.json
        manifest.json
        animations.json
        atlases/
          *.png
          *.json

  src/
    main.tsx
    App.tsx

    app/
      layout/
      providers/
      router/

    game/
      phaser/
        config.ts
        createGame.ts
      scenes/
        BootScene.ts
        PreloadScene.ts
        WorldScene.ts
      assets/
        preload.ts
        animation.ts

    features/
      hud/
      inventory/
      settings/

    shared/
      lib/
      types/
      ui/
```

## Stack Rules

- React manages UI shell, menus, overlays, and app composition.
- Phaser manages rendering, world state, scene lifecycle, and input.
- Asset generation stays outside the app runtime (`packages/bloomseed-assets/pipeline/*`).
- Runtime loads generated files from `public/assets/bloomseed/*`.

## TypeScript Strictness

Use strict settings for the frontend project:

- `"strict": true`
- `"noUncheckedIndexedAccess": true`
- `"exactOptionalPropertyTypes": true`
- `"noImplicitOverride": true`
- `"noFallthroughCasesInSwitch": true`

## Phaser Asset Loading

- Queue assets through `src/game/assets/preload.ts`.
- Register animation clips from generated manifest through `src/game/assets/animation.ts`.
- Avoid hardcoding frame lists in scenes; consume generated `animations.json`.

## Authored Content Adapters

- Runtime office bootstrap content is loaded through [`src/game/assets/officeContentRepository.ts`](./src/game/assets/officeContentRepository.ts), which currently reads checked-in/public Donarg office JSON snapshots.
- Office layout editing and saving flows through [`src/app/officeLayoutApi.ts`](./src/app/officeLayoutApi.ts), which exposes a persistence adapter interface instead of letting hooks or components call Vite endpoints directly.
- The current development-only persistence implementation lives in [`officeLayoutDevAdapter.ts`](./officeLayoutDevAdapter.ts) and is wired into [`vite.config.ts`](./vite.config.ts).
- Replacing the current Vite-backed workflow should mean swapping adapters:
  runtime content can move from the static repository to a backend-backed repository, and editor persistence can move from the development adapter to an HTTP, realtime, or collaborative adapter without rewriting the React editor logic.

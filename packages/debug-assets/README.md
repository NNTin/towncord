# Debug Assets Package

Placeholder asset package for early frontend integration and terrain iteration.

## Source Of Truth

- `aseprite/**/*.aseprite`: grouped source files
- Timeline tag names are animation IDs
- Each tag maps to a same-named layer

## Marching Squares Placeholder

The debug environment source uses an animated sprite-sheet tag:

- `tilesets.debug.environment.autotile-15`
- Each timeline frame is a full 4x4 tileset sheet (8 phases)
- Tiles are row-major case IDs:
  - row 1: `0 1 2 3`
  - row 2: `4 5 6 7`
  - row 3: `8 9 10 11`
  - row 4: `12 13 14 15`

Expected mapping strategy:

- case `N` -> `tilesets.debug.environment.autotile-15#N`
- animated variants are exported as `tilesets.debug.environment.autotile-15#N@phase`
- canonical ruleset example: `aseprite/environment/tileset.marching-squares-15.json`

## Outputs

- Phaser runtime files in `apps/frontend/public/assets/debug`
- GIF previews in `previews/` (via `export:all`) showing full sheet animation
- Sliced case frame sequences in `frames/` (via `export:all`)

## Commands

```bash
npm run export:dry
npm run export:public
npm run export:all
```

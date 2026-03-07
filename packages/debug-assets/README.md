# Debug Assets Package

Placeholder asset package for early frontend integration and terrain iteration.

## Source Of Truth

- `aseprite/**/*.aseprite`: grouped source files
- Timeline tag names are animation IDs
- Each tag maps to a same-named layer

## Marching Squares Placeholder

The debug environment source contains:

- `tilesets.debug.environment.ground-base` (outside/base tile, 1 frame)
- `tilesets.debug.environment.water-15` (15 transition frames for case IDs 1..15)

Expected mapping strategy:

- case `0` -> `tilesets.debug.environment.ground-base#0`
- case `1..15` -> `tilesets.debug.environment.water-15#(caseId - 1)`
- canonical ruleset example: `aseprite/environment/tileset.marching-squares-15.json`

## Outputs

- Phaser runtime files in `apps/frontend/public/assets/debug`
- GIF previews in `previews/` (via `export:all`)
- Frame PNG sequences in `frames/` (via `export:all`)

## Commands

```bash
npm run export:dry
npm run export:public
npm run export:all
```

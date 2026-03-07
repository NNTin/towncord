# towncord

Early scaffold for the project.

```
towncord/
│
├── apps/
│   ├── frontend/              # Browser game (Canvas / Phaser)
│   └── backend/
│       ├── gateway/               # Gateway
│       ├── discord-server/        # Discord OAuth + API
│       ├── node-red/              # Node-RED flows + config
│       └── realtime-server/       # WebSocket server (if separate)
│
├── packages/
│   └── bloomseed-assets/          # bloomseed art source repo (git submodule)
│
├── assets/
│   ├── sprites/
│   ├── audio/
│   └── fonts/
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   └── deployment/
│
├── scripts/                   # Build / migration / tooling scripts
│
├── .env.example
├── package.json
├── README.md
└── docker-compose.yml
```

## Asset Credits

This project uses art assets from [**Bloomseed** by Cocophany](https://cocophany.itch.io/bloomseed).

## Asset Import

Bloomseed source files live in:

- `packages/bloomseed-assets/aseprite/**/*.aseprite`

Initialize submodules after cloning:

```bash
git submodule update --init --recursive
```

The export pipeline reads those `.aseprite` files directly and generates the Phaser runtime contract in `apps/frontend/public/assets/bloomseed/*`.

CI note:
- `deploy.yml` expects `secrets.REPO_TOKEN` to read the private `packages/bloomseed-assets` submodule.

Local prerequisites:
- `aseprite` CLI available on `PATH`
- Python package `Pillow` installed (`python -m pip install pillow`)

```bash
npm run assets:bloomseed:dry
npm run assets:bloomseed:public
npm run assets:bloomseed:all
```

- `assets:bloomseed:dry`: validate extraction and packing only
- `assets:bloomseed:public`: write runtime atlas/manifest files for frontend
- `assets:bloomseed:all`: write runtime files + GIF previews + frame PNG sequences

Phaser preload example:

```ts
this.load.pack("bloomseed", "assets/bloomseed/pack.json");
```

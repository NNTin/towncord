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
│   ├── shared-types/          # Shared TS types/interfaces
│   ├── shared-utils/          # Shared utilities
│   └── config/                # Shared config constants
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

Bloomseed source files live in `assets/.raw/bloomseed`.

Stage 1 (`assets:bloomseed:extract`) extracts and normalizes the raw pack into `assets/sprites`, and trims unused transparent/padding space from source images.
Stage 2 (`assets:bloomseed:phaser`) packs those extracted frames into grouped Phaser atlases in `apps/frontend/public/assets/bloomseed/atlases` and writes a Phaser Asset Pack file at `apps/frontend/public/assets/bloomseed/pack.json`.

```bash
npm run assets:bloomseed:extract:dry
npm run assets:bloomseed:extract
npm run assets:bloomseed:phaser:dry
npm run assets:bloomseed:phaser
npm run assets:bloomseed
```

Phaser preload example:

```ts
this.load.pack("bloomseed", "assets/bloomseed/pack.json");
```

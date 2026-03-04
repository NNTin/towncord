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
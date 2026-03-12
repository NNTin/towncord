# towncord

Early scaffold for the project.

```
towncord/
│
├── apps/
│   ├── frontend/                     # Browser game (Canvas / Phaser)
│   └── backend/
│       ├── gateway/                  # Gateway
│       │    ├── discord/             # Discord integration
│       │    └── node-red/            # Node-RED flows integration
│       ├── db/                       # holds data
│       └── ..                        # idea needs to scaffold
├── packages/
│   │                                 # assets
│   ├── bloomseed-assets/             # git submodule: art by Cocophany
│   ├── donarg-office-assets/         # git submodule: art by Donarg
│   ├── debug-assets/                 # git submodule: placeholder art
│   │                                 # other
│   ├── public-assets/                # single PNG export
│   └── public-animation-contracts/   # enforce TS type safety
├── infrastructure/
│   ├── docker/
│   └── deployment/
├── .env.example
├── package.json
├── README.md
└── docker-compose.yml
```

Initialize submodules after cloning:

```bash
git submodule update --init --recursive
```

CI note:
- `deploy.yml` expects `secrets.REPO_TOKEN` to read the private git submodules.

Local prerequisites:
- `aseprite` CLI available on `PATH`
- Python package `Pillow` installed (`python -m pip install pillow`)

## Asset Credits

This project uses art assets from 
- [**Bloomseed** by Cocophany](https://cocophany.itch.io/bloomseed).
- [**Office Interior Tileset** by Donarg](https://donarg.itch.io/officetileset)
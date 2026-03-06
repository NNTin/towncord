import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { createGame } from "./game/phaser/createGame";
import { SidebarAccordion } from "./components/SidebarAccordion";
import type { AnimationCatalog } from "./game/assets/animationCatalog";
import {
  BLOOMSEED_READY_EVENT,
  type BloomseedUiBootstrap,
} from "./game/application/gameComposition";
import type { PlaceableViewModel } from "./game/application/placeableService";
import {
  PLACE_DRAG_MIME,
  PLACE_OBJECT_DROP_EVENT,
  PLACE_TERRAIN_DROP_EVENT,
  TERRAIN_TILE_INSPECTED_EVENT,
  type PlaceObjectDropPayload,
  type PlaceTerrainDropPayload,
  type TerrainTileInspectedPayload,
  parsePlaceDragPayload,
  toPlaceDropPayload,
} from "./game/events";

function App(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [catalog, setCatalog] = useState<AnimationCatalog | null>(null);
  const [placeables, setPlaceables] = useState<PlaceableViewModel[] | null>(null);
  const [inspectedTile, setInspectedTile] = useState<TerrainTileInspectedPayload | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const game = createGame(container);
    gameRef.current = game;

    game.events.once(BLOOMSEED_READY_EVENT, (payload: BloomseedUiBootstrap) => {
      setCatalog(payload.catalog);
      setPlaceables(payload.placeables);
    });

    function handleTerrainTileInspected(payload: TerrainTileInspectedPayload): void {
      setInspectedTile(payload);
    }
    game.events.on(TERRAIN_TILE_INSPECTED_EVENT, handleTerrainTileInspected);

    return () => {
      game.events.off(TERRAIN_TILE_INSPECTED_EVENT, handleTerrainTileInspected);
      game.destroy(true);
      gameRef.current = null;
      setPlaceables(null);
      setInspectedTile(null);
    };
  }, []);

  function handleDragOver(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    const raw = e.dataTransfer.getData(PLACE_DRAG_MIME);
    if (!raw) return;

    try {
      const dragPayload = parsePlaceDragPayload(JSON.parse(raw));
      if (!dragPayload) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dropPayload = toPlaceDropPayload(
        dragPayload,
        e.clientX - rect.left,
        e.clientY - rect.top,
      );

      if (dropPayload.type === "entity") {
        const payload: PlaceObjectDropPayload = dropPayload;
        gameRef.current?.events.emit(PLACE_OBJECT_DROP_EVENT, payload);
        return;
      }

      const terrainPayload: PlaceTerrainDropPayload = dropPayload;
      gameRef.current?.events.emit(PLACE_TERRAIN_DROP_EVENT, terrainPayload);
    } catch {
      // ignore malformed drag data
    }
  }

  return (
    <main className="app">
      {catalog && placeables && (
        <SidebarAccordion
          catalog={catalog}
          placeables={placeables}
          inspectedTile={inspectedTile}
          onClearInspectedTile={() => setInspectedTile(null)}
        />
      )}
      <div
        ref={containerRef}
        className="game-root"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />
    </main>
  );
}

export default App;

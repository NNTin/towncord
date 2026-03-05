import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { createGame } from "./game/phaser/createGame";
import { SidebarAccordion } from "./components/SidebarAccordion";
import { buildAnimationCatalog, type AnimationCatalog } from "./game/assets/animationCatalog";
import {
  PLACE_DRAG_MIME,
  PLACE_OBJECT_DROP_EVENT,
  type PlaceDragPayload,
  type PlaceObjectDropPayload,
} from "./game/events";

function App(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [catalog, setCatalog] = useState<AnimationCatalog | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const game = createGame(container);
    gameRef.current = game;

    game.events.once("bloomseedReady", (keys: string[]) => {
      setCatalog(buildAnimationCatalog(keys));
    });

    return () => {
      game.destroy(true);
      gameRef.current = null;
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
      const data = JSON.parse(raw) as PlaceDragPayload;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const payload: PlaceObjectDropPayload = {
        type: data.type,
        model: data.model,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
      };
      gameRef.current?.events.emit(PLACE_OBJECT_DROP_EVENT, payload);
    } catch {
      // ignore malformed drag data
    }
  }

  return (
    <main className="app">
      {catalog && <SidebarAccordion catalog={catalog} />}
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

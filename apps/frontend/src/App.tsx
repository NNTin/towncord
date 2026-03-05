import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { createGame } from "./game/phaser/createGame";
import { AnimationSelector } from "./components/AnimationSelector";
import { buildAnimationCatalog, type AnimationCatalog } from "./game/assets/animationCatalog";

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

  return (
    <main className="app">
      <div ref={containerRef} className="game-root" />
      {catalog && <AnimationSelector gameRef={gameRef} catalog={catalog} />}
    </main>
  );
}

export default App;

import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import { createGame } from "./game/phaser/createGame";

function App(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    gameRef.current = createGame(container);

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <main className="app">
      <div ref={containerRef} className="game-root" />
    </main>
  );
}

export default App;

import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { createGame } from "./game/phaser/createGame";
import { AnimationSelector } from "./components/AnimationSelector";
import { parseAnimationGroups, type AnimationGroups } from "./game/assets/animationGroups";

function App(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [animationGroups, setAnimationGroups] = useState<AnimationGroups>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const game = createGame(container);
    gameRef.current = game;

    game.events.once("bloomseedReady", (keys: string[]) => {
      setAnimationGroups(parseAnimationGroups(keys));
    });

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <main className="app">
      <div ref={containerRef} className="game-root" />
      {animationGroups.size > 0 && (
        <AnimationSelector gameRef={gameRef} animationGroups={animationGroups} />
      )}
    </main>
  );
}

export default App;

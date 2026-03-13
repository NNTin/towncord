import { BottomToolbar } from "./components/BottomToolbar";
import { SidebarAccordion } from "./components/SidebarAccordion";
import { useBloomseedUiBridge } from "./game/application/useBloomseedUiBridge";

function App(): JSX.Element {
  const {
    gameRootRef,
    onGameRootDragOver,
    onGameRootDrop,
    sidebarProps,
    bottomToolbarProps,
  } = useBloomseedUiBridge();

  return (
    <main className="app">
      {sidebarProps ? <SidebarAccordion {...sidebarProps} /> : null}
      <BottomToolbar {...bottomToolbarProps} />
      <div
        ref={gameRootRef}
        className="game-root"
        onDragOver={onGameRootDragOver}
        onDrop={onGameRootDrop}
      />
    </main>
  );
}

export default App;

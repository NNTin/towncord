import { SidebarAccordion } from "./components/SidebarAccordion";
import { ZoomControls } from "./components/ZoomControls";
import { useBloomseedUiBridge } from "./game/application/useBloomseedUiBridge";

function App(): JSX.Element {
  const {
    gameRootRef,
    onGameRootDragOver,
    onGameRootDrop,
    sidebarProps,
    zoomProps,
  } = useBloomseedUiBridge();

  return (
    <main className="app">
      {sidebarProps ? <SidebarAccordion {...sidebarProps} /> : null}
      {zoomProps ? <ZoomControls {...zoomProps} /> : null}
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

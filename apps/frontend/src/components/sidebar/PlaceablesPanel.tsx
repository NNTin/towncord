import { useState } from "react";
import type { PlaceableViewModel } from "../../game/application/placeableService";
import { AccordionHeader } from "./common";

type Props = {
  playerPlaceables: PlaceableViewModel[];
  npcPlaceables: PlaceableViewModel[];
  onDragStart: (e: React.DragEvent, placeable: PlaceableViewModel) => void;
};

function DraggableEntry({
  label,
  onDragStart,
}: {
  label: string;
  onDragStart: (e: React.DragEvent) => void;
}): JSX.Element {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 4,
        color: "#cbd5e1",
        cursor: "grab",
        fontSize: 12,
        padding: "5px 8px",
        userSelect: "none",
      }}
    >
      ⊕ {label}
    </div>
  );
}

export function PlaceablesPanel({
  playerPlaceables,
  npcPlaceables,
  onDragStart,
}: Props): JSX.Element {
  const [playerOpen, setPlayerOpen] = useState(true);
  const [mobsOpen, setMobsOpen] = useState(true);

  return (
    <>
      <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2, textTransform: "uppercase", letterSpacing: 1 }}>
        Placeables
      </div>

      <AccordionHeader label="Player" open={playerOpen} onToggle={() => setPlayerOpen((v) => !v)} />
      {playerOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 8 }}>
          {playerPlaceables.map((placeable) => (
            <DraggableEntry
              key={placeable.entityId}
              label={placeable.label}
              onDragStart={(e) => onDragStart(e, placeable)}
            />
          ))}
        </div>
      )}

      {npcPlaceables.length > 0 && (
        <>
          <AccordionHeader label="Mobs" open={mobsOpen} onToggle={() => setMobsOpen((v) => !v)} />
          {mobsOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 8 }}>
              {npcPlaceables.map((placeable) => (
                <DraggableEntry
                  key={placeable.entityId}
                  label={placeable.label}
                  onDragStart={(e) => onDragStart(e, placeable)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

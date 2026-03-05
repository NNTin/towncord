import { useState } from "react";
import type { AnimationCatalog } from "../game/assets/animationCatalog";
import { PLACE_DRAG_MIME, type PlaceDragPayload } from "../game/events";

type Props = {
  catalog: AnimationCatalog;
};

const LABEL_STYLE: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 1,
};

function AccordionHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <button
      onClick={onToggle}
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 4,
        color: "#e2e8f0",
        cursor: "pointer",
        fontFamily: "monospace",
        fontSize: 12,
        padding: "5px 8px",
        textAlign: "left",
        width: "100%",
      }}
    >
      {open ? "▾" : "▸"} {label}
    </button>
  );
}

function DraggableEntry({
  label,
  payload,
}: {
  label: string;
  payload: PlaceDragPayload;
}): JSX.Element {
  function handleDragStart(e: React.DragEvent): void {
    e.dataTransfer.setData(PLACE_DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 4,
        color: "#cbd5e1",
        cursor: "grab",
        fontFamily: "monospace",
        fontSize: 12,
        padding: "5px 8px",
        userSelect: "none",
      }}
    >
      ⊕ {label}
    </div>
  );
}

export function SidebarAccordion({ catalog }: Props): JSX.Element {
  const [playerOpen, setPlayerOpen] = useState(true);

  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.9)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "monospace",
        gap: 4,
        height: "100%",
        left: 0,
        overflowY: "auto",
        padding: "8px 6px",
        position: "absolute",
        top: 0,
        width: 160,
        zIndex: 10,
      }}
    >
      <div style={{ ...LABEL_STYLE, marginBottom: 4 }}>Placeables</div>

      <AccordionHeader
        label="Player"
        open={playerOpen}
        onToggle={() => setPlayerOpen((v) => !v)}
      />
      {playerOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 8 }}>
          {catalog.playerModels.map((model) => (
            <DraggableEntry key={model} label={model} payload={{ type: "player", model }} />
          ))}
        </div>
      )}

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          color: "#475569",
          fontSize: 10,
          lineHeight: 1.7,
          marginTop: "auto",
          paddingTop: 8,
        }}
      >
        <div>Drag to place player</div>
        <div style={{ marginTop: 4 }}>
          WASD move · Shift run
          <br />
          Mid-drag pan · Scroll zoom
        </div>
      </div>
    </div>
  );
}

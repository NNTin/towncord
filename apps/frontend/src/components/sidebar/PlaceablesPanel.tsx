import { useState } from "react";
import type { PlaceableViewModel } from "../../game/application/placeableService";
import { AccordionHeader } from "./common";

type Props = {
  placeables: PlaceableViewModel[];
  onDragStart: (e: React.DragEvent, placeable: PlaceableViewModel) => void;
};

type PlaceableGroup = {
  key: string;
  label: string;
  placeables: PlaceableViewModel[];
};

function groupPlaceablesByKind(placeables: PlaceableViewModel[]): PlaceableGroup[] {
  const byKind = new Map<string, PlaceableGroup>();

  for (const placeable of placeables) {
    if (!byKind.has(placeable.groupKey)) {
      byKind.set(placeable.groupKey, {
        key: placeable.groupKey,
        label: placeable.groupLabel,
        placeables: [],
      });
    }

    byKind.get(placeable.groupKey)!.placeables.push(placeable);
  }

  return [...byKind.values()];
}

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
  placeables,
  onDragStart,
}: Props): JSX.Element {
  const [openByKind, setOpenByKind] = useState<Record<string, boolean>>({});
  const groups = groupPlaceablesByKind(placeables);

  return (
    <>
      <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2, textTransform: "uppercase", letterSpacing: 1 }}>
        Placeables
      </div>

      {groups.map((group) => {
        const open = openByKind[group.key] ?? true;
        return (
          <div key={group.key}>
            <AccordionHeader
              label={group.label}
              open={open}
              onToggle={() =>
                setOpenByKind((current) => ({
                  ...current,
                  [group.key]: !(current[group.key] ?? true),
                }))
              }
            />
            {open && (
              <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 8 }}>
                {group.placeables.map((placeable) => (
                  <DraggableEntry
                    key={placeable.id}
                    label={placeable.label}
                    onDragStart={(e) => onDragStart(e, placeable)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

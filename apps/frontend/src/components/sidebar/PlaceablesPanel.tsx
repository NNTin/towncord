import { useState } from "react";
import type { PlaceablesPanelViewModel } from "../../game/application/runtimeViewModels";
import { AccordionHeader } from "./common";

type PlaceableGroup = {
  key: string;
  label: string;
  placeables: PlaceablesPanelViewModel["placeables"];
};

function groupPlaceablesByGroup(
  placeables: PlaceablesPanelViewModel["placeables"],
): PlaceableGroup[] {
  const byGroup = new Map<string, PlaceableGroup>();

  for (const placeable of placeables) {
    if (!byGroup.has(placeable.groupKey)) {
      byGroup.set(placeable.groupKey, {
        key: placeable.groupKey,
        label: placeable.groupLabel,
        placeables: [],
      });
    }

    byGroup.get(placeable.groupKey)!.placeables.push(placeable);
  }

  return [...byGroup.values()];
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

function TerrainToolEntry({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        background: active ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.05)",
        border: active ? "1px solid rgba(56,189,248,0.75)" : "1px solid rgba(255,255,255,0.12)",
        borderRadius: 4,
        color: active ? "#e0f2fe" : "#cbd5e1",
        cursor: "pointer",
        fontSize: 12,
        padding: "5px 8px",
        textAlign: "left",
      }}
    >
      {active ? "●" : "○"} {label}
    </button>
  );
}

export function PlaceablesPanel({
  viewModel,
}: {
  viewModel: PlaceablesPanelViewModel;
}): JSX.Element {
  const [openByGroup, setOpenByGroup] = useState<Record<string, boolean>>({});
  const groups = groupPlaceablesByGroup(viewModel.placeables);

  return (
    <>
      <div
        style={{
          color: "#94a3b8",
          fontSize: 11,
          marginBottom: 2,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        Placeables
      </div>

      {groups.map((group) => {
        const open = openByGroup[group.key] ?? true;
        return (
          <div key={group.key}>
            <AccordionHeader
              label={group.label}
              open={open}
              onToggle={() =>
                setOpenByGroup((current) => ({
                  ...current,
                  [group.key]: !(current[group.key] ?? true),
                }))
              }
            />
            {open && (
              <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 8 }}>
                {group.placeables.map((placeable) =>
                  placeable.type === "terrain" ? (
                    <TerrainToolEntry
                      key={placeable.id}
                      active={viewModel.activeTerrainToolId === placeable.id}
                      label={placeable.label}
                      onClick={() => viewModel.onSelectTerrainTool(placeable)}
                    />
                  ) : (
                    <DraggableEntry
                      key={placeable.id}
                      label={placeable.label}
                      onDragStart={(event) => viewModel.onDragStart(event, placeable)}
                    />
                  ),
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

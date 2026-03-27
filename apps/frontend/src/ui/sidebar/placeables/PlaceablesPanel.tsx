import type { PlaceablesPanelViewModel } from "../../game-session/contracts";
import { groupPlaceablesByGroup } from "../../game-session/view-models/placeablesBridge";
import { useGroupedDisclosureState } from "../../state/panel-state";
import { AccordionHeader } from "../shared/common";

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
        background: "var(--ui-surface-muted)",
        border: "1px solid var(--ui-border-strong)",
        borderRadius: 4,
        color: "var(--ui-text-secondary)",
        cursor: "grab",
        fontFamily: "var(--ui-font-mono)",
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
        background: active
          ? "var(--ui-accent-soft)"
          : "var(--ui-surface-muted)",
        border: active
          ? "1px solid var(--ui-accent-strong)"
          : "1px solid var(--ui-border-strong)",
        borderRadius: 4,
        color: active ? "var(--ui-accent-text)" : "var(--ui-text-secondary)",
        cursor: "pointer",
        fontFamily: "var(--ui-font-mono)",
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
  const groupDisclosure = useGroupedDisclosureState();
  const groups = groupPlaceablesByGroup(viewModel.placeables);

  return (
    <>
      <div
        style={{
          color: "var(--ui-text-muted)",
          fontSize: 11,
          marginBottom: 2,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        Placeables
      </div>

      {groups.map((group) => {
        const open = groupDisclosure.isOpen(group.key);
        return (
          <div key={group.key}>
            <AccordionHeader
              label={group.label}
              open={open}
              onToggle={() => groupDisclosure.toggle(group.key)}
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

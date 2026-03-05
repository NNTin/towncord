import { useState, useEffect, useRef } from "react";
import {
  type AnimationCatalog,
  type AnimationTrack,
  type EntityType,
  type InputDirection,
  getMobIds,
  getPropGroups,
  getTracksForPath,
} from "../game/assets/animationCatalog";
import type { PlaceableObjectType } from "../game/events";
import { type EquipmentId, type Material, MATERIALS } from "../game/assets/equipmentGroups";
import { PLACE_DRAG_MIME, type PlaceDragPayload } from "../game/events";
import { AnimationPreview, type PreviewInfo } from "./AnimationPreview";

type Props = {
  catalog: AnimationCatalog;
};

const PLACEABLE_MOB_IDS: Exclude<PlaceableObjectType, "player">[] = ["chicken", "cow", "bat", "slime"];
const PLACEABLE_MOB_ID_SET: ReadonlySet<string> = new Set(PLACEABLE_MOB_IDS);

function isPlaceableMobId(id: string): id is Exclude<PlaceableObjectType, "player"> {
  return PLACEABLE_MOB_ID_SET.has(id);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BUTTON_BASE: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 4,
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: 12,
  padding: "5px 8px",
  textAlign: "left",
  transition: "background 0.1s",
  width: "100%",
};

function activeBtn(isActive: boolean): React.CSSProperties {
  return {
    ...BUTTON_BASE,
    background: isActive ? "#3b82f6" : "rgba(255,255,255,0.05)",
    border: isActive ? "1px solid #60a5fa" : "1px solid rgba(255,255,255,0.1)",
    color: isActive ? "#fff" : "#cbd5e1",
  };
}

const SECTION_LABEL_STYLE: React.CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.1)",
  color: "#94a3b8",
  fontSize: 11,
  letterSpacing: 1,
  marginTop: 6,
  paddingTop: 6,
  textTransform: "uppercase",
};

function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return <div style={SECTION_LABEL_STYLE}>{children}</div>;
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
      style={{ ...BUTTON_BASE, background: "rgba(255,255,255,0.05)", color: "#e2e8f0" }}
    >
      {open ? "▾" : "▸"} {label}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: "#cbd5e1", textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selector initial state
// ---------------------------------------------------------------------------

type SelectorState = {
  entityType: EntityType;
  playerFamily: string;
  mobFamily: string;
  mobId: string;
  propFamily: string;
  propGroup: string;
  trackId: string;
  equipmentId: EquipmentId | "";
};

function getInitialState(catalog: AnimationCatalog): SelectorState {
  const playerModel = catalog.playerModels[0] ?? "female";
  const playerTracks = getTracksForPath(catalog, `player/${playerModel}`);
  const defaultTrack = playerTracks.find((t) => t.id === "run") ?? playerTracks[0];

  const mobFamily = catalog.mobFamilies[0] ?? "";
  const mobId = getMobIds(catalog, mobFamily)[0] ?? "";
  const propFamily = catalog.propFamilies[0] ?? "";
  const propGroup = getPropGroups(catalog, propFamily)[0] ?? "";

  return {
    entityType: "player",
    playerFamily: playerModel,
    mobFamily,
    mobId,
    propFamily,
    propGroup,
    trackId: defaultTrack?.id ?? "",
    equipmentId: defaultTrack?.equipmentCompatible[0] ?? "",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared WASD keyboard state → preview direction
// ---------------------------------------------------------------------------

function useWASDDirection(): InputDirection {
  const [direction, setDirection] = useState<InputDirection>("down");
  const heldKeys = useRef(new Set<string>());

  useEffect(() => {
    function derive(): InputDirection | null {
      const k = heldKeys.current;
      if (k.has("d")) return "right";
      if (k.has("a")) return "left";
      if (k.has("s")) return "down";
      if (k.has("w")) return "up";
      return null; // no key held — caller keeps previous
    }

    function onKeyDown(e: KeyboardEvent): void {
      const key = e.key.toLowerCase();
      if (!["w", "a", "s", "d"].includes(key)) return;
      heldKeys.current.add(key);
      const dir = derive();
      if (dir) setDirection(dir);
    }

    function onKeyUp(e: KeyboardEvent): void {
      const key = e.key.toLowerCase();
      if (!["w", "a", "s", "d"].includes(key)) return;
      heldKeys.current.delete(key);
      const dir = derive();
      if (dir) setDirection(dir);
      // If no WASD key is held, keep the last direction shown
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return direction;
}

export function SidebarAccordion({ catalog }: Props): JSX.Element {
  const previewDirection = useWASDDirection();

  // Accordion state
  const [playerOpen, setPlayerOpen] = useState(true);
  const [mobsOpen, setMobsOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [animOpen, setAnimOpen] = useState(true);

  // Entity selector state — initial values computed once via lazy initializer
  const [initState] = useState<SelectorState>(() => getInitialState(catalog));
  const [entityType, setEntityType] = useState<EntityType>(initState.entityType);
  const [playerFamily, setPlayerFamily] = useState(initState.playerFamily);
  const [mobFamily, setMobFamily] = useState(initState.mobFamily);
  const [mobId, setMobId] = useState(initState.mobId);
  const [propFamily, setPropFamily] = useState(initState.propFamily);
  const [propGroup, setPropGroup] = useState(initState.propGroup);
  const [selectedTrackId, setSelectedTrackId] = useState(initState.trackId);
  const [equipmentId, setEquipmentId] = useState<EquipmentId | "">(initState.equipmentId);
  const [material, setMaterial] = useState<Material>("iron");

  // Animation info fed back from the preview renderer
  const [animInfo, setAnimInfo] = useState<PreviewInfo | null>(null);

  // ---------------------------------------------------------------------------
  // Path helpers
  // ---------------------------------------------------------------------------

  function resolvePropPath(family: string, group: string): string {
    if (group) return `props/${family}/${group}`;
    if (family === "static") return "props/static";
    return `props/${family}`;
  }

  function getCurrentPath(
    et: EntityType,
    pf: string,
    mf: string,
    mi: string,
    prpF: string,
    prpG: string,
  ): string {
    switch (et) {
      case "player": return `player/${pf}`;
      case "mobs":   return `mobs/${mf}/${mi}`;
      case "props":  return resolvePropPath(prpF, prpG);
    }
  }

  const currentPath = getCurrentPath(
    entityType, playerFamily, mobFamily, mobId, propFamily, propGroup,
  );
  const currentTracks = getTracksForPath(catalog, currentPath);
  const currentTrack = currentTracks.find((t) => t.id === selectedTrackId) ?? currentTracks[0] ?? null;
  const propGroups = getPropGroups(catalog, propFamily);
  const compatible = currentTrack?.equipmentCompatible ?? [];
  const placeableMobs = catalog.mobFamilies.flatMap((family) =>
    getMobIds(catalog, family)
      .filter(isPlaceableMobId)
      .map((id) => ({ family, id })),
  );

  // ---------------------------------------------------------------------------
  // Selector state transitions
  // (No Phaser event emissions needed — AnimationPreview reacts to props.)
  // ---------------------------------------------------------------------------

  function activateTrack(track: AnimationTrack, equip: EquipmentId | ""): void {
    setSelectedTrackId(track.id);
    setEquipmentId(equip);
  }

  function switchToPath(newPath: string, overrideTrackId?: string, overrideEquip?: EquipmentId | ""): void {
    const tracks = getTracksForPath(catalog, newPath);
    const track = tracks.find((t) => t.id === (overrideTrackId ?? selectedTrackId)) ?? tracks[0] ?? null;
    if (!track) return;
    const currentEquip = overrideEquip ?? equipmentId;
    const newEquip = track.equipmentCompatible.includes(currentEquip as EquipmentId)
      ? currentEquip
      : (track.equipmentCompatible[0] ?? "");
    activateTrack(track, newEquip);
  }

  function handleEntityType(et: EntityType): void {
    setEntityType(et);
    switchToPath(getCurrentPath(et, playerFamily, mobFamily, mobId, propFamily, propGroup));
  }

  function handlePlayerFamily(family: string): void {
    setPlayerFamily(family);
    switchToPath(`player/${family}`);
  }

  function handleMobFamily(family: string): void {
    const ids = getMobIds(catalog, family);
    const newId = ids[0] ?? "";
    setMobFamily(family);
    setMobId(newId);
    switchToPath(`mobs/${family}/${newId}`);
  }

  function handleMobId(id: string): void {
    setMobId(id);
    switchToPath(`mobs/${mobFamily}/${id}`);
  }

  function handlePropFamily(family: string): void {
    const groups = getPropGroups(catalog, family);
    const newGroup = groups[0] ?? "";
    setPropFamily(family);
    setPropGroup(newGroup);
    switchToPath(resolvePropPath(family, newGroup));
  }

  function handlePropGroup(group: string): void {
    setPropGroup(group);
    switchToPath(resolvePropPath(propFamily, group));
  }

  function handleSelectTrack(track: AnimationTrack): void {
    const compat = track.equipmentCompatible;
    const newEquip = compat.includes(equipmentId as EquipmentId) ? equipmentId : (compat[0] ?? "");
    activateTrack(track, newEquip);
  }

  function handleSelectEquipment(equip: EquipmentId): void {
    setEquipmentId(equip);
  }

  function handleSelectMaterial(mat: Material): void {
    setMaterial(mat);
  }

  // ---------------------------------------------------------------------------
  // Drag payload for placeables
  // ---------------------------------------------------------------------------

  function handleDragStart(e: React.DragEvent, payload: PlaceDragPayload): void {
    e.dataTransfer.setData(PLACE_DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
        width: 180,
        zIndex: 10,
      }}
    >
      {/* ── Placeables ─────────────────────────────────────────── */}
      <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2, textTransform: "uppercase", letterSpacing: 1 }}>
        Placeables
      </div>

      <AccordionHeader label="Player" open={playerOpen} onToggle={() => setPlayerOpen((v) => !v)} />
      {playerOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 8 }}>
          {catalog.playerModels.map((model) => (
            <DraggableEntry
              key={model}
              label={model}
              onDragStart={(e) =>
                handleDragStart(e, { type: "player", model, catalogPath: `player/${model}` })
              }
            />
          ))}
        </div>
      )}

      {placeableMobs.length > 0 && (
        <>
          <AccordionHeader label="Mobs" open={mobsOpen} onToggle={() => setMobsOpen((v) => !v)} />
          {mobsOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 8 }}>
              {placeableMobs.map(({ family, id }) => (
                <DraggableEntry
                  key={`${family}:${id}`}
                  label={id}
                  onDragStart={(e) =>
                    handleDragStart(e, {
                      type: id,
                      model: id,
                      catalogPath: `mobs/${family}/${id}`,
                    })
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Preview selector ───────────────────────────────────── */}
      <SectionLabel>Preview</SectionLabel>
      <AccordionHeader label="Entity" open={previewOpen} onToggle={() => setPreviewOpen((v) => !v)} />
      {previewOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 4 }}>
          {/* Entity type */}
          {catalog.entityTypes.map((et) => (
            <button key={et} onClick={() => handleEntityType(et)} style={activeBtn(entityType === et)}>
              {et}
            </button>
          ))}

          {/* Player family */}
          {entityType === "player" && catalog.playerModels.length > 1 && (
            <>
              <SectionLabel>Family</SectionLabel>
              {catalog.playerModels.map((f) => (
                <button key={f} onClick={() => handlePlayerFamily(f)} style={activeBtn(playerFamily === f)}>
                  {f}
                </button>
              ))}
            </>
          )}

          {/* Mob family + id */}
          {entityType === "mobs" && (
            <>
              <SectionLabel>Family</SectionLabel>
              {catalog.mobFamilies.map((f) => (
                <button key={f} onClick={() => handleMobFamily(f)} style={activeBtn(mobFamily === f)}>
                  {f}
                </button>
              ))}
              <SectionLabel>Mob</SectionLabel>
              {getMobIds(catalog, mobFamily).map((id) => (
                <button key={id} onClick={() => handleMobId(id)} style={activeBtn(mobId === id)}>
                  {id}
                </button>
              ))}
            </>
          )}

          {/* Prop family + group */}
          {entityType === "props" && (
            <>
              <SectionLabel>Family</SectionLabel>
              {catalog.propFamilies.map((f) => (
                <button key={f} onClick={() => handlePropFamily(f)} style={activeBtn(propFamily === f)}>
                  {f}
                </button>
              ))}
              {propGroups.length > 0 && (
                <>
                  <SectionLabel>Group</SectionLabel>
                  {propGroups.map((g) => (
                    <button key={g} onClick={() => handlePropGroup(g)} style={activeBtn(propGroup === g)}>
                      {g}
                    </button>
                  ))}
                </>
              )}
            </>
          )}

          {/* Track */}
          <SectionLabel>Animation</SectionLabel>
          {currentTracks.map((track) => (
            <button
              key={track.id}
              onClick={() => handleSelectTrack(track)}
              style={activeBtn(currentTrack?.id === track.id)}
            >
              {track.label}
            </button>
          ))}

          {/* Equipment + material */}
          {compatible.length > 0 && (
            <>
              <SectionLabel>Equipment</SectionLabel>
              {compatible.map((equip) => (
                <button
                  key={equip}
                  onClick={() => handleSelectEquipment(equip)}
                  style={activeBtn(equipmentId === equip)}
                >
                  {equip}
                </button>
              ))}
              <SectionLabel>Material</SectionLabel>
              <div style={{ display: "flex", gap: 4 }}>
                {MATERIALS.map((mat) => (
                  <button
                    key={mat}
                    onClick={() => handleSelectMaterial(mat)}
                    style={{ ...activeBtn(material === mat), flex: 1, textAlign: "center", padding: "4px 2px" }}
                  >
                    {mat}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Animated preview canvas */}
          <SectionLabel>Preview</SectionLabel>
          <AnimationPreview
            track={currentTrack}
            direction={previewDirection}
            equipmentId={equipmentId}
            material={material}
            onInfo={setAnimInfo}
          />
        </div>
      )}

      {/* ── Animation info ─────────────────────────────────────── */}
      <SectionLabel>Info</SectionLabel>
      <AccordionHeader label="Animation" open={animOpen} onToggle={() => setAnimOpen((v) => !v)} />
      {animOpen && (
        <div
          style={{
            background: "rgba(15, 23, 42, 0.5)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 4,
            display: "flex",
            flexDirection: "column",
            fontSize: 11,
            gap: 3,
            marginLeft: 4,
            padding: "6px 7px",
          }}
        >
          {animInfo ? (
            <>
              <InfoRow label="key" value={animInfo.animationKey} />
              <InfoRow label="frame" value={`${animInfo.frameWidth}×${animInfo.frameHeight}`} />
              <InfoRow label="frames" value={String(animInfo.frameCount)} />
              <InfoRow label="display" value={`${animInfo.displayWidth}×${animInfo.displayHeight}`} />
              <InfoRow label="flipX" value={animInfo.flipX ? "yes" : "no"} />
            </>
          ) : (
            <span style={{ color: "#475569" }}>Loading preview…</span>
          )}
        </div>
      )}

      {/* ── Controls hint ──────────────────────────────────────── */}
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
        Drag to place · Click to select
        <br />
        WASD move · Shift run (player)
        <br />
        Mid-drag pan · Scroll zoom
      </div>
    </div>
  );
}

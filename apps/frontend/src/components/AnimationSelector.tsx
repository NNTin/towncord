import { useEffect, useState } from "react";
import type Phaser from "phaser";
import {
  type AnimationCatalog,
  type AnimationTrack,
  type EntityType,
  getMobIds,
  getPropGroups,
  getTracksForPath,
} from "../game/assets/animationCatalog";
import { type EquipmentId, type Material, MATERIALS } from "../game/assets/equipmentGroups";
import {
  ANIMATION_DISPLAY_INFO_EVENT,
  ANIMATION_DISPLAY_INFO_REQUEST_EVENT,
  type AnimationDisplayInfo,
} from "../game/events";

type Props = {
  gameRef: React.RefObject<Phaser.Game | null>;
  catalog: AnimationCatalog;
};

const BUTTON_BASE: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 4,
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: 12,
  padding: "5px 8px",
  textAlign: "left" as const,
  transition: "background 0.1s",
};

function activeBtn(isActive: boolean): React.CSSProperties {
  return {
    ...BUTTON_BASE,
    background: isActive ? "#3b82f6" : "rgba(255,255,255,0.05)",
    border: isActive ? "1px solid #60a5fa" : "1px solid rgba(255,255,255,0.1)",
    color: isActive ? "#fff" : "#cbd5e1",
  };
}

function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        marginTop: 8,
        paddingTop: 8,
        borderTop: "1px solid rgba(255,255,255,0.1)",
        color: "#94a3b8",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1,
      }}
    >
      {children}
    </div>
  );
}

function getInitialState(catalog: AnimationCatalog): {
  entityType: EntityType;
  playerFamily: string;
  mobFamily: string;
  mobId: string;
  propFamily: string;
  propGroup: string;
  trackId: string;
  equipmentId: EquipmentId | "";
} {
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

export function AnimationSelector({ gameRef, catalog }: Props): JSX.Element {
  const init = () => getInitialState(catalog);

  const [entityType, setEntityType] = useState<EntityType>(init().entityType);
  const [playerFamily, setPlayerFamily] = useState(init().playerFamily);
  const [mobFamily, setMobFamily] = useState(init().mobFamily);
  const [mobId, setMobId] = useState(init().mobId);
  const [propFamily, setPropFamily] = useState(init().propFamily);
  const [propGroup, setPropGroup] = useState(init().propGroup);
  const [selectedTrackId, setSelectedTrackId] = useState(init().trackId);
  const [equipmentId, setEquipmentId] = useState<EquipmentId | "">(init().equipmentId);
  const [material, setMaterial] = useState<Material>("iron");
  const [displayedAnimation, setDisplayedAnimation] = useState<AnimationDisplayInfo | null>(null);

  function resolvePropPath(family: string, group: string): string {
    if (group) {
      return `props/${family}/${group}`;
    }
    if (family === "static") {
      return "props/static";
    }
    return `props/${family}`;
  }

  function getCurrentPath(
    et: EntityType,
    player: string,
    mf: string,
    mi: string,
    pf: string,
    pg: string,
  ): string {
    switch (et) {
      case "player":
        return `player/${player}`;
      case "mobs":
        return `mobs/${mf}/${mi}`;
      case "props":
        return resolvePropPath(pf, pg);
    }
  }

  const currentPath = getCurrentPath(
    entityType,
    playerFamily,
    mobFamily,
    mobId,
    propFamily,
    propGroup,
  );
  const currentTracks = getTracksForPath(catalog, currentPath);
  const currentTrack = currentTracks.find((t) => t.id === selectedTrackId) ?? currentTracks[0] ?? null;
  const propGroups = getPropGroups(catalog, propFamily);

  function emitTrack(track: AnimationTrack): void {
    gameRef.current?.events.emit("animationSelected", track);
  }

  function emitEquipment(equip: EquipmentId | "", mat: Material): void {
    if (equip) {
      gameRef.current?.events.emit("equipmentSelected", { equipmentId: equip, material: mat });
    }
  }

  function activateTrack(track: AnimationTrack, equip: EquipmentId | "", mat: Material): void {
    setSelectedTrackId(track.id);
    emitTrack(track);
    if (track.equipmentCompatible.length > 0 && equip) {
      emitEquipment(equip, mat);
    }
  }

  useEffect(() => {
    if (currentTrack) {
      emitTrack(currentTrack);
      if (currentTrack.equipmentCompatible.length > 0 && equipmentId) {
        emitEquipment(equipmentId, material);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) {
      return;
    }

    const handleDisplayInfo = (payload: AnimationDisplayInfo): void => {
      setDisplayedAnimation(payload);
    };

    game.events.on(ANIMATION_DISPLAY_INFO_EVENT, handleDisplayInfo);
    game.events.emit(ANIMATION_DISPLAY_INFO_REQUEST_EVENT);

    return () => {
      game.events.off(ANIMATION_DISPLAY_INFO_EVENT, handleDisplayInfo);
    };
  }, [gameRef]);

  function switchToPath(
    newPath: string,
    overrideTrackId?: string,
    equip?: EquipmentId | "",
    mat?: Material,
  ): void {
    const tracks = getTracksForPath(catalog, newPath);
    const track = tracks.find((t) => t.id === (overrideTrackId ?? selectedTrackId)) ?? tracks[0] ?? null;
    if (!track) return;
    const resolvedEquip = equip ?? equipmentId;
    const resolvedMat = mat ?? material;
    const newEquip = track.equipmentCompatible.includes(resolvedEquip as EquipmentId)
      ? resolvedEquip
      : (track.equipmentCompatible[0] ?? "");
    if (newEquip !== resolvedEquip) setEquipmentId(newEquip);
    activateTrack(track, newEquip, resolvedMat);

  }

  function handleEntityType(et: EntityType): void {
    setEntityType(et);
    const newPath = getCurrentPath(et, playerFamily, mobFamily, mobId, propFamily, propGroup);
    switchToPath(newPath);
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
    const newPath = resolvePropPath(family, newGroup);
    switchToPath(newPath);
  }

  function handlePropGroup(group: string): void {
    setPropGroup(group);
    switchToPath(resolvePropPath(propFamily, group));
  }

  function handleSelectTrack(track: AnimationTrack): void {
    const compat = track.equipmentCompatible;
    const newEquip = compat.includes(equipmentId as EquipmentId) ? equipmentId : (compat[0] ?? "");
    if (newEquip !== equipmentId) setEquipmentId(newEquip);
    activateTrack(track, newEquip, material);
  }

  function handleSelectEquipment(equip: EquipmentId): void {
    setEquipmentId(equip);
    emitEquipment(equip, material);
  }

  function handleSelectMaterial(mat: Material): void {
    setMaterial(mat);
    emitEquipment(equipmentId, mat);
  }

  const compatible = currentTrack?.equipmentCompatible ?? [];

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 180,
        height: "100%",
        background: "rgba(15, 23, 42, 0.85)",
        display: "flex",
        flexDirection: "column",
        padding: "8px 6px",
        gap: 4,
        overflowY: "auto",
        fontFamily: "monospace",
        zIndex: 10,
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
        Entity
      </div>
      {catalog.entityTypes.map((et) => (
        <button key={et} onClick={() => handleEntityType(et)} style={activeBtn(entityType === et)}>
          {et}
        </button>
      ))}

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

      {entityType === "player" && (
        <>
          <SectionLabel>Family</SectionLabel>
          {catalog.playerModels.map((family) => (
            <button
              key={family}
              onClick={() => handlePlayerFamily(family)}
              style={activeBtn(playerFamily === family)}
            >
              {family}
            </button>
          ))}
        </>
      )}

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

      <SectionLabel>Displayed</SectionLabel>
      <div
        style={{
          color: "#cbd5e1",
          fontSize: 11,
          lineHeight: 1.5,
          wordBreak: "break-word",
          background: "rgba(15, 23, 42, 0.5)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 4,
          padding: "6px 7px",
        }}
      >
        <div>Key: {displayedAnimation?.animationKey ?? "-"}</div>
        <div>
          Frame: {displayedAnimation ? `${displayedAnimation.frameWidth} x ${displayedAnimation.frameHeight}` : "-"}
        </div>
        <div>Frames: {displayedAnimation?.frameCount ?? "-"}</div>
        <div>
          Display:{" "}
          {displayedAnimation ? `${displayedAnimation.displayWidth} x ${displayedAnimation.displayHeight}` : "-"}
        </div>
      </div>

      {compatible.length > 0 && (
        <>
          <SectionLabel>Equipment</SectionLabel>
          {compatible.map((equip) => (
            <button key={equip} onClick={() => handleSelectEquipment(equip)} style={activeBtn(equipmentId === equip)}>
              {equip}
            </button>
          ))}
          <SectionLabel>Material</SectionLabel>
          <div style={{ display: "flex", gap: 4 }}>
            {MATERIALS.map((mat) => (
              <button
                key={mat}
                onClick={() => handleSelectMaterial(mat)}
                style={{
                  ...activeBtn(material === mat),
                  flex: 1,
                  textAlign: "center" as const,
                  padding: "4px 2px",
                }}
              >
                {mat}
              </button>
            ))}
          </div>
        </>
      )}

      <div
        style={{
          marginTop: "auto",
          paddingTop: 8,
          borderTop: "1px solid rgba(255,255,255,0.1)",
          color: "#64748b",
          fontSize: 11,
          textAlign: "center",
        }}
      >
        W↑ &nbsp; A← &nbsp; S↓ &nbsp; D→
      </div>
    </div>
  );
}

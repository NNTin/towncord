import { useEffect, useRef, useState } from "react";
import {
  type AnimationCatalog,
  type AnimationTrack,
  type EntityType,
  type InputDirection,
  type TilesetFamily,
  getMobIds,
  getPropGroups,
  resolveTrackForDirection,
  getTilesetGroups,
  getTracksForPath,
} from "../../game/assets/animationCatalog";
import { type EquipmentId, type Material, MATERIALS } from "../../game/assets/equipmentGroups";
import type { TerrainTileInspectedPayload } from "../../game/events";
import { AnimationPreview, type PreviewInfo } from "../AnimationPreview";
import { AccordionHeader, SectionLabel, activeBtn } from "./common";

type Props = {
  catalog: AnimationCatalog;
  inspectedTile: TerrainTileInspectedPayload | null;
  onClearInspectedTile: () => void;
  onInfo: (info: PreviewInfo | null) => void;
};

type SelectorState = {
  entityType: EntityType;
  playerFamily: string;
  mobFamily: string;
  mobId: string;
  propFamily: string;
  propGroup: string;
  tilesetFamily: TilesetFamily;
  tilesetGroup: string;
  trackId: string;
  equipmentId: EquipmentId | "";
};

function getInitialState(catalog: AnimationCatalog): SelectorState {
  const playerModel = catalog.playerModels[0] ?? "female";
  const playerTracks = getTracksForPath(catalog, `player/${playerModel}`);
  const defaultTrack = playerTracks.find((track) => track.id === "run") ?? playerTracks[0];

  const mobFamily = catalog.mobFamilies[0] ?? "";
  const mobId = getMobIds(catalog, mobFamily)[0] ?? "";
  const propFamily = catalog.propFamilies[0] ?? "";
  const propGroup = getPropGroups(catalog, propFamily)[0] ?? "";
  const tilesetFamily = catalog.tilesetFamilies.includes("static") ? "static" : catalog.tilesetFamilies[0]!;
  const tilesetGroup = getTilesetGroups(catalog, tilesetFamily)[0] ?? "";

  return {
    entityType: "player",
    playerFamily: playerModel,
    mobFamily,
    mobId,
    propFamily,
    propGroup,
    tilesetFamily,
    tilesetGroup,
    trackId: defaultTrack?.id ?? "",
    equipmentId: defaultTrack?.equipmentCompatible[0] ?? "",
  };
}

function useWASDDirection(): InputDirection {
  const [direction, setDirection] = useState<InputDirection>("down");
  const heldKeys = useRef(new Set<string>());

  useEffect(() => {
    function derive(): InputDirection | null {
      const keys = heldKeys.current;
      if (keys.has("d")) return "right";
      if (keys.has("a")) return "left";
      if (keys.has("s")) return "down";
      if (keys.has("w")) return "up";
      return null;
    }

    function onKeyDown(event: KeyboardEvent): void {
      const key = event.key.toLowerCase();
      if (!["w", "a", "s", "d"].includes(key)) return;
      heldKeys.current.add(key);
      const next = derive();
      if (next) setDirection(next);
    }

    function onKeyUp(event: KeyboardEvent): void {
      const key = event.key.toLowerCase();
      if (!["w", "a", "s", "d"].includes(key)) return;
      heldKeys.current.delete(key);
      const next = derive();
      if (next) setDirection(next);
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

function resolvePropPath(family: string, group: string): string {
  if (group) return `props/${family}/${group}`;
  if (family === "static") return "props/static";
  return `props/${family}`;
}

function resolveTilesetPath(family: TilesetFamily, group: string): string {
  if (group) return `tilesets/${family}/${group}`;
  return `tilesets/${family}`;
}

function getCurrentPath(
  et: EntityType,
  pf: string,
  mf: string,
  mi: string,
  prpF: string,
  prpG: string,
  tsF: TilesetFamily,
  tsG: string,
): string {
  switch (et) {
    case "player": return `player/${pf}`;
    case "mobs": return `mobs/${mf}/${mi}`;
    case "props": return resolvePropPath(prpF, prpG);
    case "tilesets": return resolveTilesetPath(tsF, tsG);
  }
}

export function PreviewPanel({
  catalog,
  inspectedTile,
  onClearInspectedTile,
  onInfo,
}: Props): JSX.Element {
  const previewDirection = useWASDDirection();

  const [previewOpen, setPreviewOpen] = useState(true);

  const [initState] = useState<SelectorState>(() => getInitialState(catalog));
  const [entityType, setEntityType] = useState<EntityType>(initState.entityType);
  const [playerFamily, setPlayerFamily] = useState(initState.playerFamily);
  const [mobFamily, setMobFamily] = useState(initState.mobFamily);
  const [mobId, setMobId] = useState(initState.mobId);
  const [propFamily, setPropFamily] = useState(initState.propFamily);
  const [propGroup, setPropGroup] = useState(initState.propGroup);
  const [tilesetFamily, setTilesetFamily] = useState(initState.tilesetFamily);
  const [tilesetGroup, setTilesetGroup] = useState(initState.tilesetGroup);
  const [tilesetFrameIndex, setTilesetFrameIndex] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState(initState.trackId);
  const [equipmentId, setEquipmentId] = useState<EquipmentId | "">(initState.equipmentId);
  const [material, setMaterial] = useState<Material>("iron");
  const [previewInfo, setPreviewInfo] = useState<PreviewInfo | null>(null);

  const currentPath = getCurrentPath(
    entityType,
    playerFamily,
    mobFamily,
    mobId,
    propFamily,
    propGroup,
    tilesetFamily,
    tilesetGroup,
  );
  const currentTracks = getTracksForPath(catalog, currentPath);
  const currentTrack = currentTracks.find((track) => track.id === selectedTrackId) ?? currentTracks[0] ?? null;
  const propGroups = getPropGroups(catalog, propFamily);
  const tilesetGroups = getTilesetGroups(catalog, tilesetFamily);
  const isTilesetStatic = entityType === "tilesets" && tilesetFamily === "static";
  const expectedPreviewKey = currentTrack
    ? resolveTrackForDirection(currentTrack, previewDirection)?.key ?? null
    : null;
  const compatible = currentTrack?.equipmentCompatible ?? [];
  const maxTilesetFrameIndex =
    isTilesetStatic &&
    previewInfo?.sourceType === "animation" &&
    expectedPreviewKey !== null &&
    previewInfo.animationKey === expectedPreviewKey
      ? Math.max(0, previewInfo.frameCount - 1)
      : null;
  const resolvedTilesetFrameIndex =
    maxTilesetFrameIndex === null
      ? Math.max(0, tilesetFrameIndex)
      : Math.min(Math.max(0, tilesetFrameIndex), maxTilesetFrameIndex);

  useEffect(() => {
    if (!isTilesetStatic) {
      setTilesetFrameIndex(0);
    }
  }, [isTilesetStatic]);

  function activateTrack(track: AnimationTrack, equip: EquipmentId | ""): void {
    setSelectedTrackId(track.id);
    setEquipmentId(equip);
  }

  function switchToPath(newPath: string, overrideTrackId?: string, overrideEquip?: EquipmentId | ""): void {
    const tracks = getTracksForPath(catalog, newPath);
    const track = tracks.find((item) => item.id === (overrideTrackId ?? selectedTrackId)) ?? tracks[0] ?? null;
    if (!track) return;
    const currentEquip = overrideEquip ?? equipmentId;
    const nextEquip = track.equipmentCompatible.includes(currentEquip as EquipmentId)
      ? currentEquip
      : (track.equipmentCompatible[0] ?? "");
    activateTrack(track, nextEquip);
  }

  function handleEntityType(nextEntityType: EntityType): void {
    setEntityType(nextEntityType);
    switchToPath(
      getCurrentPath(
        nextEntityType,
        playerFamily,
        mobFamily,
        mobId,
        propFamily,
        propGroup,
        tilesetFamily,
        tilesetGroup,
      ),
    );
  }

  function handlePlayerFamily(family: string): void {
    setPlayerFamily(family);
    switchToPath(`player/${family}`);
  }

  function handleMobFamily(family: string): void {
    const ids = getMobIds(catalog, family);
    const nextId = ids[0] ?? "";
    setMobFamily(family);
    setMobId(nextId);
    switchToPath(`mobs/${family}/${nextId}`);
  }

  function handleMobId(id: string): void {
    setMobId(id);
    switchToPath(`mobs/${mobFamily}/${id}`);
  }

  function handlePropFamily(family: string): void {
    const groups = getPropGroups(catalog, family);
    const nextGroup = groups[0] ?? "";
    setPropFamily(family);
    setPropGroup(nextGroup);
    switchToPath(resolvePropPath(family, nextGroup));
  }

  function handlePropGroup(group: string): void {
    setPropGroup(group);
    switchToPath(resolvePropPath(propFamily, group));
  }

  function handleTilesetFamily(family: TilesetFamily): void {
    const groups = getTilesetGroups(catalog, family);
    const nextGroup = groups[0] ?? "";
    setTilesetFamily(family);
    setTilesetGroup(nextGroup);
    setTilesetFrameIndex(0);
    switchToPath(resolveTilesetPath(family, nextGroup));
  }

  function handleTilesetGroup(group: string): void {
    setTilesetGroup(group);
    setTilesetFrameIndex(0);
    switchToPath(resolveTilesetPath(tilesetFamily, group));
  }

  function handleSelectTrack(track: AnimationTrack): void {
    const compatibleEquipment = track.equipmentCompatible;
    const nextEquip = compatibleEquipment.includes(equipmentId as EquipmentId)
      ? equipmentId
      : (compatibleEquipment[0] ?? "");
    if (entityType === "tilesets") {
      setTilesetFrameIndex(0);
    }
    activateTrack(track, nextEquip);
  }

  function handlePreviewInfo(info: PreviewInfo | null): void {
    setPreviewInfo(info);
    onInfo(info);
  }

  return (
    <>
      <SectionLabel>Preview</SectionLabel>
      <AccordionHeader label="Entity" open={previewOpen} onToggle={() => setPreviewOpen((v) => !v)} />
      {previewOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 4 }}>
          {catalog.entityTypes.map((et) => (
            <button key={et} onClick={() => handleEntityType(et)} style={activeBtn(entityType === et)}>
              {et}
            </button>
          ))}

          {entityType === "player" && catalog.playerModels.length > 1 && (
            <>
              <SectionLabel>Family</SectionLabel>
              {catalog.playerModels.map((family) => (
                <button key={family} onClick={() => handlePlayerFamily(family)} style={activeBtn(playerFamily === family)}>
                  {family}
                </button>
              ))}
            </>
          )}

          {entityType === "mobs" && (
            <>
              <SectionLabel>Family</SectionLabel>
              {catalog.mobFamilies.map((family) => (
                <button key={family} onClick={() => handleMobFamily(family)} style={activeBtn(mobFamily === family)}>
                  {family}
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

          {entityType === "props" && (
            <>
              <SectionLabel>Family</SectionLabel>
              {catalog.propFamilies.map((family) => (
                <button key={family} onClick={() => handlePropFamily(family)} style={activeBtn(propFamily === family)}>
                  {family}
                </button>
              ))}
              {propGroups.length > 0 && (
                <>
                  <SectionLabel>Group</SectionLabel>
                  {propGroups.map((group) => (
                    <button key={group} onClick={() => handlePropGroup(group)} style={activeBtn(propGroup === group)}>
                      {group}
                    </button>
                  ))}
                </>
              )}
            </>
          )}

          {entityType === "tilesets" && (
            <>
              <SectionLabel>Family</SectionLabel>
              {catalog.tilesetFamilies.map((family) => (
                <button key={family} onClick={() => handleTilesetFamily(family)} style={activeBtn(tilesetFamily === family)}>
                  {family}
                </button>
              ))}
              {tilesetGroups.length > 0 && (
                <>
                  <SectionLabel>Group</SectionLabel>
                  {tilesetGroups.map((group) => (
                    <button key={group} onClick={() => handleTilesetGroup(group)} style={activeBtn(tilesetGroup === group)}>
                      {group}
                    </button>
                  ))}
                </>
              )}
              {tilesetGroups.length === 0 && (
                <div style={{ color: "#94a3b8", fontSize: 11 }}>
                  No tilesets in this family yet
                </div>
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
          {isTilesetStatic && currentTrack && (
            <>
              <SectionLabel>Tile</SectionLabel>
              <div style={{ alignItems: "center", display: "flex", gap: 4 }}>
                <button
                  onClick={() => setTilesetFrameIndex((value) => Math.max(0, value - 1))}
                  style={{ ...activeBtn(false), minWidth: 30, padding: "4px 0" }}
                >
                  -
                </button>
                <input
                  type="number"
                  min={0}
                  max={maxTilesetFrameIndex ?? undefined}
                  value={resolvedTilesetFrameIndex}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    setTilesetFrameIndex(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
                  }}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 4,
                    color: "#cbd5e1",
                    flex: 1,
                    fontFamily: "inherit",
                    fontSize: 12,
                    padding: "4px 6px",
                  }}
                />
                <button
                  onClick={() =>
                    setTilesetFrameIndex((value) =>
                      maxTilesetFrameIndex === null ? value + 1 : Math.min(maxTilesetFrameIndex, value + 1),
                    )
                  }
                  style={{ ...activeBtn(false), minWidth: 30, padding: "4px 0" }}
                >
                  +
                </button>
              </div>
              {maxTilesetFrameIndex !== null && (
                <div style={{ color: "#94a3b8", fontSize: 10 }}>
                  Tile {resolvedTilesetFrameIndex + 1} / {maxTilesetFrameIndex + 1}
                </div>
              )}
            </>
          )}

          {compatible.length > 0 && (
            <>
              <SectionLabel>Equipment</SectionLabel>
              {compatible.map((equip) => (
                <button
                  key={equip}
                  onClick={() => setEquipmentId(equip)}
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
                    onClick={() => setMaterial(mat)}
                    style={{ ...activeBtn(material === mat), flex: 1, textAlign: "center", padding: "4px 2px" }}
                  >
                    {mat}
                  </button>
                ))}
              </div>
            </>
          )}

          <SectionLabel>Preview</SectionLabel>
          {inspectedTile && (
            <>
              <div style={{ color: "#94a3b8", fontSize: 10 }}>
                Inspecting tile {inspectedTile.cellX},{inspectedTile.cellY}
              </div>
              <button onClick={onClearInspectedTile} style={activeBtn(false)}>
                Back to animation
              </button>
            </>
          )}
          <AnimationPreview
            track={currentTrack}
            direction={previewDirection}
            equipmentId={equipmentId}
            material={material}
            frameIndex={isTilesetStatic ? resolvedTilesetFrameIndex : null}
            inspectedTile={inspectedTile}
            onInfo={handlePreviewInfo}
          />
        </div>
      )}
    </>
  );
}

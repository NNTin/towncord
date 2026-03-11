import { useEffect, useRef, useState } from "react";
import {
  type AnimationCatalog,
  type InputDirection,
  resolveTrackForDirection,
} from "../../game/assets/animationCatalog";
import { type Material, MATERIALS } from "../../game/assets/equipmentGroups";
import type { TerrainTileInspectedPayload } from "../../game/events";
import { AnimationPreview, type PreviewInfo } from "../AnimationPreview";
import { AccordionHeader, SectionLabel, activeBtn } from "./common";
import { usePreviewSelectionModel } from "./usePreviewSelectionModel";

type Props = {
  catalog: AnimationCatalog;
  inspectedTile: TerrainTileInspectedPayload | null;
  onClearInspectedTile: () => void;
  onInfo: (info: PreviewInfo | null) => void;
};

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

export function PreviewPanel({
  catalog,
  inspectedTile,
  onClearInspectedTile,
  onInfo,
}: Props): JSX.Element {
  const previewDirection = useWASDDirection();

  const [previewOpen, setPreviewOpen] = useState(true);
  const [material, setMaterial] = useState<Material>("iron");
  const [previewInfo, setPreviewInfo] = useState<PreviewInfo | null>(null);
  const {
    entityType,
    playerFamily,
    mobFamily,
    mobId,
    propFamily,
    propGroup,
    tilesetFamily,
    tilesetGroup,
    tilesetFrameIndex,
    currentTrack,
    currentTracks,
    mobIds,
    propGroups,
    tilesetGroups,
    isTilesetStatic,
    compatibleEquipment,
    selectEntityType,
    selectPlayerFamily,
    selectMobFamily,
    selectMobId,
    selectPropFamily,
    selectPropGroup,
    selectTilesetFamily,
    selectTilesetGroup,
    selectTrack,
    equipmentId,
    setEquipmentId,
    setTilesetFrameIndex,
  } = usePreviewSelectionModel(catalog);
  const expectedPreviewKey = currentTrack
    ? resolveTrackForDirection(currentTrack, previewDirection)?.key ?? null
    : null;
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
            <button key={et} onClick={() => selectEntityType(et)} style={activeBtn(entityType === et)}>
              {et}
            </button>
          ))}

          {entityType === "player" && catalog.playerModels.length > 1 && (
            <>
              <SectionLabel>Family</SectionLabel>
              {catalog.playerModels.map((family) => (
                <button key={family} onClick={() => selectPlayerFamily(family)} style={activeBtn(playerFamily === family)}>
                  {family}
                </button>
              ))}
            </>
          )}

          {entityType === "mobs" && (
            <>
              <SectionLabel>Family</SectionLabel>
              {catalog.mobFamilies.map((family) => (
                <button key={family} onClick={() => selectMobFamily(family)} style={activeBtn(mobFamily === family)}>
                  {family}
                </button>
              ))}
              <SectionLabel>Mob</SectionLabel>
              {mobIds.map((id) => (
                <button key={id} onClick={() => selectMobId(id)} style={activeBtn(mobId === id)}>
                  {id}
                </button>
              ))}
            </>
          )}

          {entityType === "props" && (
            <>
              <SectionLabel>Family</SectionLabel>
              {catalog.propFamilies.map((family) => (
                <button key={family} onClick={() => selectPropFamily(family)} style={activeBtn(propFamily === family)}>
                  {family}
                </button>
              ))}
              {propGroups.length > 0 && (
                <>
                  <SectionLabel>Group</SectionLabel>
                  {propGroups.map((group) => (
                    <button key={group} onClick={() => selectPropGroup(group)} style={activeBtn(propGroup === group)}>
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
                <button key={family} onClick={() => selectTilesetFamily(family)} style={activeBtn(tilesetFamily === family)}>
                  {family}
                </button>
              ))}
              {tilesetGroups.length > 0 && (
                <>
                  <SectionLabel>Group</SectionLabel>
                  {tilesetGroups.map((group) => (
                    <button key={group} onClick={() => selectTilesetGroup(group)} style={activeBtn(tilesetGroup === group)}>
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
              onClick={() => selectTrack(track)}
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

          {compatibleEquipment.length > 0 && (
            <>
              <SectionLabel>Equipment</SectionLabel>
              {compatibleEquipment.map((equip) => (
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

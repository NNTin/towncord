import { useEffect, useState, type SetStateAction } from "react";
import {
  type AnimationCatalog,
  type AnimationTrack,
  type EntityType,
  type TilesetFamily,
  getMobIds,
  getPropGroups,
  getTilesetGroups,
  getTracksForPath,
} from "../../game/assets/animationCatalog";
import type { EquipmentId } from "../../game/assets/equipmentGroups";

type PreviewSelectionState = {
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
  tilesetFrameIndex: number;
};

type PreviewSelectionPathState = Pick<
  PreviewSelectionState,
  "entityType" | "playerFamily" | "mobFamily" | "mobId" | "propFamily" | "propGroup" | "tilesetFamily" | "tilesetGroup"
>;

function createInitialSelection(catalog: AnimationCatalog): PreviewSelectionState {
  const playerFamily = catalog.playerModels[0] ?? "female";
  const playerTracks = getTracksForPath(catalog, `player/${playerFamily}`);
  const defaultTrack = playerTracks.find((track) => track.id === "run") ?? playerTracks[0] ?? null;

  const mobFamily = catalog.mobFamilies[0] ?? "";
  const mobId = getMobIds(catalog, mobFamily)[0] ?? "";
  const propFamily = catalog.propFamilies[0] ?? "";
  const propGroup = getPropGroups(catalog, propFamily)[0] ?? "";
  const tilesetFamily = catalog.tilesetFamilies.includes("static") ? "static" : catalog.tilesetFamilies[0]!;
  const tilesetGroup = getTilesetGroups(catalog, tilesetFamily)[0] ?? "";

  return {
    entityType: "player",
    playerFamily,
    mobFamily,
    mobId,
    propFamily,
    propGroup,
    tilesetFamily,
    tilesetGroup,
    trackId: defaultTrack?.id ?? "",
    equipmentId: defaultTrack?.equipmentCompatible[0] ?? "",
    tilesetFrameIndex: 0,
  };
}

function getPropPath(family: string, group: string): string {
  if (group) return `props/${family}/${group}`;
  if (family === "static") return "props/static";
  return `props/${family}`;
}

function getTilesetPath(family: TilesetFamily, group: string): string {
  if (group) return `tilesets/${family}/${group}`;
  return `tilesets/${family}`;
}

function getSelectionPath(selection: PreviewSelectionPathState): string {
  switch (selection.entityType) {
    case "player":
      return `player/${selection.playerFamily}`;
    case "mobs":
      return `mobs/${selection.mobFamily}/${selection.mobId}`;
    case "props":
      return getPropPath(selection.propFamily, selection.propGroup);
    case "tilesets":
      return getTilesetPath(selection.tilesetFamily, selection.tilesetGroup);
  }
}

function isTrackEquipmentCompatible(
  track: AnimationTrack,
  equipmentId: EquipmentId | "",
): equipmentId is EquipmentId {
  return equipmentId !== "" && track.equipmentCompatible.includes(equipmentId);
}

function resolveEquipmentId(track: AnimationTrack, equipmentId: EquipmentId | ""): EquipmentId | "" {
  return isTrackEquipmentCompatible(track, equipmentId) ? equipmentId : (track.equipmentCompatible[0] ?? "");
}

function resolveTrack(
  catalog: AnimationCatalog,
  selection: PreviewSelectionState,
  preferredTrackId: string,
): AnimationTrack | null {
  const tracks = getTracksForPath(catalog, getSelectionPath(selection));
  return tracks.find((track) => track.id === preferredTrackId) ?? tracks[0] ?? null;
}

function syncTrackSelection(
  catalog: AnimationCatalog,
  selection: PreviewSelectionState,
  preferredTrackId: string,
  preferredEquipmentId: EquipmentId | "",
): PreviewSelectionState {
  const track = resolveTrack(catalog, selection, preferredTrackId);
  if (!track) return selection;

  return {
    ...selection,
    trackId: track.id,
    equipmentId: resolveEquipmentId(track, preferredEquipmentId),
  };
}

function applyTrackSelection(
  selection: PreviewSelectionState,
  track: AnimationTrack,
): PreviewSelectionState {
  return {
    ...selection,
    trackId: track.id,
    equipmentId: resolveEquipmentId(track, selection.equipmentId),
    tilesetFrameIndex: selection.entityType === "tilesets" ? 0 : selection.tilesetFrameIndex,
  };
}

export function usePreviewSelectionModel(catalog: AnimationCatalog) {
  const [selection, setSelection] = useState<PreviewSelectionState>(() => createInitialSelection(catalog));

  const currentTracks = getTracksForPath(catalog, getSelectionPath(selection));
  const currentTrack = currentTracks.find((track) => track.id === selection.trackId) ?? currentTracks[0] ?? null;
  const mobIds = getMobIds(catalog, selection.mobFamily);
  const propGroups = getPropGroups(catalog, selection.propFamily);
  const tilesetGroups = getTilesetGroups(catalog, selection.tilesetFamily);
  const isTilesetStatic = selection.entityType === "tilesets" && selection.tilesetFamily === "static";
  const compatibleEquipment = currentTrack?.equipmentCompatible ?? [];

  useEffect(() => {
    if (!isTilesetStatic) {
      setSelection((prev) =>
        prev.tilesetFrameIndex === 0 ? prev : { ...prev, tilesetFrameIndex: 0 },
      );
    }
  }, [isTilesetStatic]);

  return {
    entityType: selection.entityType,
    playerFamily: selection.playerFamily,
    mobFamily: selection.mobFamily,
    mobId: selection.mobId,
    propFamily: selection.propFamily,
    propGroup: selection.propGroup,
    tilesetFamily: selection.tilesetFamily,
    tilesetGroup: selection.tilesetGroup,
    equipmentId: selection.equipmentId,
    tilesetFrameIndex: selection.tilesetFrameIndex,
    currentTrack,
    currentTracks,
    mobIds,
    propGroups,
    tilesetGroups,
    isTilesetStatic,
    compatibleEquipment,
    selectEntityType(nextEntityType: EntityType): void {
      setSelection((prev) =>
        syncTrackSelection(
          catalog,
          { ...prev, entityType: nextEntityType },
          prev.trackId,
          prev.equipmentId,
        ),
      );
    },
    selectPlayerFamily(playerFamily: string): void {
      setSelection((prev) =>
        syncTrackSelection(
          catalog,
          { ...prev, playerFamily },
          prev.trackId,
          prev.equipmentId,
        ),
      );
    },
    selectMobFamily(mobFamily: string): void {
      setSelection((prev) =>
        syncTrackSelection(
          catalog,
          { ...prev, mobFamily, mobId: getMobIds(catalog, mobFamily)[0] ?? "" },
          prev.trackId,
          prev.equipmentId,
        ),
      );
    },
    selectMobId(mobId: string): void {
      setSelection((prev) =>
        syncTrackSelection(
          catalog,
          { ...prev, mobId },
          prev.trackId,
          prev.equipmentId,
        ),
      );
    },
    selectPropFamily(propFamily: string): void {
      setSelection((prev) =>
        syncTrackSelection(
          catalog,
          { ...prev, propFamily, propGroup: getPropGroups(catalog, propFamily)[0] ?? "" },
          prev.trackId,
          prev.equipmentId,
        ),
      );
    },
    selectPropGroup(propGroup: string): void {
      setSelection((prev) =>
        syncTrackSelection(
          catalog,
          { ...prev, propGroup },
          prev.trackId,
          prev.equipmentId,
        ),
      );
    },
    selectTilesetFamily(tilesetFamily: TilesetFamily): void {
      setSelection((prev) =>
        syncTrackSelection(
          catalog,
          {
            ...prev,
            tilesetFamily,
            tilesetGroup: getTilesetGroups(catalog, tilesetFamily)[0] ?? "",
            tilesetFrameIndex: 0,
          },
          prev.trackId,
          prev.equipmentId,
        ),
      );
    },
    selectTilesetGroup(tilesetGroup: string): void {
      setSelection((prev) =>
        syncTrackSelection(
          catalog,
          { ...prev, tilesetGroup, tilesetFrameIndex: 0 },
          prev.trackId,
          prev.equipmentId,
        ),
      );
    },
    selectTrack(track: AnimationTrack): void {
      setSelection((prev) => applyTrackSelection(prev, track));
    },
    setEquipmentId(equipmentId: EquipmentId | ""): void {
      setSelection((prev) => (prev.equipmentId === equipmentId ? prev : { ...prev, equipmentId }));
    },
    setTilesetFrameIndex(value: SetStateAction<number>): void {
      setSelection((prev) => {
        const nextValue = typeof value === "function" ? value(prev.tilesetFrameIndex) : value;
        return prev.tilesetFrameIndex === nextValue ? prev : { ...prev, tilesetFrameIndex: nextValue };
      });
    },
  };
}

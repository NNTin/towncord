import { useEffect, useState } from "react";
import type Phaser from "phaser";
import type { AnimationGroups } from "../game/assets/animationGroups";
import {
  type EquipmentId,
  type Material,
  MATERIALS,
  getCompatibleEquipment,
} from "../game/assets/equipmentGroups";

type Props = {
  gameRef: React.RefObject<Phaser.Game | null>;
  animationGroups: AnimationGroups;
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

export function AnimationSelector({ gameRef, animationGroups }: Props): JSX.Element {
  const sortedBaseTypes = [...animationGroups.keys()].sort();
  const defaultBaseType = sortedBaseTypes.includes("run") ? "run" : (sortedBaseTypes[0] ?? "");

  const [selected, setSelected] = useState(defaultBaseType);
  const [equipmentId, setEquipmentId] = useState<EquipmentId | "">("");
  const [material, setMaterial] = useState<Material>("iron");

  // Derive compatible equipment for current selection
  const compatible = getCompatibleEquipment(selected);

  function emitEquipment(equip: EquipmentId | "", mat: Material): void {
    if (equip) {
      gameRef.current?.events.emit("equipmentSelected", { equipmentId: equip, material: mat });
    }
  }

  function handleSelectAnimation(baseType: string): void {
    setSelected(baseType);
    gameRef.current?.events.emit("animationSelected", baseType);

    const compat = getCompatibleEquipment(baseType);
    const defaultEquip = compat[0] ?? "";
    setEquipmentId(defaultEquip);
    emitEquipment(defaultEquip, material);
  }

  function handleSelectEquipment(equip: EquipmentId): void {
    setEquipmentId(equip);
    emitEquipment(equip, material);
  }

  function handleSelectMaterial(mat: Material): void {
    setMaterial(mat);
    emitEquipment(equipmentId, mat);
  }

  useEffect(() => {
    if (defaultBaseType) {
      gameRef.current?.events.emit("animationSelected", defaultBaseType);
      const compat = getCompatibleEquipment(defaultBaseType);
      const defaultEquip = compat[0] ?? "";
      if (defaultEquip) {
        setEquipmentId(defaultEquip);
        emitEquipment(defaultEquip, material);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        Animations
      </div>

      {sortedBaseTypes.map((baseType) => (
        <button key={baseType} onClick={() => handleSelectAnimation(baseType)} style={activeBtn(selected === baseType)}>
          {baseType}
        </button>
      ))}

      {compatible.length > 0 && (
        <>
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
            Equipment
          </div>
          {compatible.map((equip) => (
            <button key={equip} onClick={() => handleSelectEquipment(equip)} style={activeBtn(equipmentId === equip)}>
              {equip}
            </button>
          ))}

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
            Material
          </div>
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

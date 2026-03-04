import { useEffect, useState } from "react";
import type Phaser from "phaser";
import type { AnimationGroups } from "../game/assets/animationGroups";

type Props = {
  gameRef: React.RefObject<Phaser.Game | null>;
  animationGroups: AnimationGroups;
};

export function AnimationSelector({ gameRef, animationGroups }: Props): JSX.Element {
  const sortedBaseTypes = [...animationGroups.keys()].sort();
  const defaultBaseType = sortedBaseTypes.includes("run") ? "run" : (sortedBaseTypes[0] ?? "");
  const [selected, setSelected] = useState(defaultBaseType);

  useEffect(() => {
    if (defaultBaseType) {
      gameRef.current?.events.emit("animationSelected", defaultBaseType);
    }
  }, []);

  function handleSelect(baseType: string): void {
    setSelected(baseType);
    gameRef.current?.events.emit("animationSelected", baseType);
  }

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
        <button
          key={baseType}
          onClick={() => handleSelect(baseType)}
          style={{
            background: selected === baseType ? "#3b82f6" : "rgba(255,255,255,0.05)",
            border: selected === baseType ? "1px solid #60a5fa" : "1px solid rgba(255,255,255,0.1)",
            borderRadius: 4,
            color: selected === baseType ? "#fff" : "#cbd5e1",
            cursor: "pointer",
            fontFamily: "monospace",
            fontSize: 12,
            padding: "5px 8px",
            textAlign: "left",
            transition: "background 0.1s",
          }}
        >
          {baseType}
        </button>
      ))}
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

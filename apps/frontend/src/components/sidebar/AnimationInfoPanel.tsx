import { useState } from "react";
import type { PreviewInfo } from "../AnimationPreview";
import { AccordionHeader, SectionLabel } from "./common";

type Props = {
  animInfo: PreviewInfo | null;
};

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: "#cbd5e1", textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

export function AnimationInfoPanel({ animInfo }: Props): JSX.Element {
  const [animOpen, setAnimOpen] = useState(true);

  return (
    <>
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
    </>
  );
}

import { useState } from "react";
import type { PreviewInfo } from "../AnimationPreview";
import {
  AccordionHeader,
  KeyValueRow,
  PanelBody,
  SectionLabel,
} from "./common";

type Props = {
  animInfo: PreviewInfo | null;
};

const INFO_VALUE_STYLE: React.CSSProperties = {
  textAlign: "right",
  wordBreak: "break-all",
};

export function AnimationInfoPanel({ animInfo }: Props): JSX.Element {
  const [animOpen, setAnimOpen] = useState(true);

  return (
    <>
      <SectionLabel>Info</SectionLabel>
      <AccordionHeader
        label="Animation"
        open={animOpen}
        onToggle={() => setAnimOpen((v) => !v)}
      />
      {animOpen && (
        <PanelBody gap={3}>
          {animInfo ? (
            <>
              <KeyValueRow
                label="type"
                value={
                  animInfo.sourceType === "terrain-tile"
                    ? "terrain tile"
                    : "animation"
                }
                gap={4}
                valueStyle={INFO_VALUE_STYLE}
              />
              <KeyValueRow
                label="key"
                value={animInfo.animationKey}
                gap={4}
                valueStyle={INFO_VALUE_STYLE}
              />
              {animInfo.sourceType === "terrain-tile" && (
                <>
                  <KeyValueRow
                    label="material"
                    value={animInfo.materialId ?? "-"}
                    gap={4}
                    valueStyle={INFO_VALUE_STYLE}
                  />
                  <KeyValueRow
                    label="cell"
                    value={
                      animInfo.cellX !== undefined &&
                      animInfo.cellY !== undefined
                        ? `${animInfo.cellX},${animInfo.cellY}`
                        : "-"
                    }
                    gap={4}
                    valueStyle={INFO_VALUE_STYLE}
                  />
                  <KeyValueRow
                    label="case"
                    value={
                      animInfo.caseId !== undefined
                        ? String(animInfo.caseId)
                        : "-"
                    }
                    gap={4}
                    valueStyle={INFO_VALUE_STYLE}
                  />
                  <KeyValueRow
                    label="rotate90"
                    value={
                      animInfo.rotate90 !== undefined
                        ? String(animInfo.rotate90)
                        : "0"
                    }
                    gap={4}
                    valueStyle={INFO_VALUE_STYLE}
                  />
                  <KeyValueRow
                    label="flipY"
                    value={animInfo.flipY ? "yes" : "no"}
                    gap={4}
                    valueStyle={INFO_VALUE_STYLE}
                  />
                </>
              )}
              <KeyValueRow
                label="frame"
                value={`${animInfo.frameWidth}×${animInfo.frameHeight}`}
                gap={4}
                valueStyle={INFO_VALUE_STYLE}
              />
              <KeyValueRow
                label="frames"
                value={String(animInfo.frameCount)}
                gap={4}
                valueStyle={INFO_VALUE_STYLE}
              />
              <KeyValueRow
                label="display"
                value={`${animInfo.displayWidth}×${animInfo.displayHeight}`}
                gap={4}
                valueStyle={INFO_VALUE_STYLE}
              />
              <KeyValueRow
                label="flipX"
                value={animInfo.flipX ? "yes" : "no"}
                gap={4}
                valueStyle={INFO_VALUE_STYLE}
              />
            </>
          ) : (
            <span style={{ color: "#475569" }}>Loading preview…</span>
          )}
        </PanelBody>
      )}
    </>
  );
}

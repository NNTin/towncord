import { useEffect, useMemo, useState } from "react";
import type { RuntimePerfPayload } from "../../game/protocol";
import {
  AccordionHeader,
  KeyValueRow,
  PanelBody,
  SectionLabel,
} from "./common";

type Props = {
  perf: RuntimePerfPayload | null;
};

const HISTORY_CAPACITY = 100;
const CHART_WIDTH = 156;
const CHART_HEIGHT = 56;

function appendHistory(values: number[], next: number): number[] {
  const merged = [...values, next];
  if (merged.length <= HISTORY_CAPACITY) return merged;
  return merged.slice(merged.length - HISTORY_CAPACITY);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function toLinePoints(values: number[], maxValue: number): string {
  if (values.length === 0 || maxValue <= 0) return "";

  const span = Math.max(1, values.length - 1);
  return values
    .map((value, index) => {
      const x = (index / span) * CHART_WIDTH;
      const y =
        CHART_HEIGHT -
        (Math.max(0, Math.min(value, maxValue)) / maxValue) * CHART_HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

const CHART_SECTION_STYLE: React.CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.08)",
  marginTop: 2,
  paddingTop: 6,
};

const CHART_STYLE: React.CSSProperties = {
  background: "rgba(2, 6, 23, 0.6)",
  border: "1px solid rgba(148,163,184,0.2)",
  borderRadius: 4,
};

function HistoryChart({
  title,
  points,
  stroke,
  summary,
}: {
  title: string;
  points: string;
  stroke: string;
  summary: string;
}): JSX.Element {
  return (
    <div style={CHART_SECTION_STYLE}>
      <div style={{ color: "#94a3b8", marginBottom: 4 }}>{title}</div>
      <svg
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        style={CHART_STYLE}
      >
        <polyline fill="none" stroke={stroke} strokeWidth="2" points={points} />
      </svg>
      <div style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>
        {summary}
      </div>
    </div>
  );
}

export function RuntimePerfPanel({ perf }: Props): JSX.Element {
  const [open, setOpen] = useState(true);
  const [fpsHistory, setFpsHistory] = useState<number[]>([]);
  const [updateHistory, setUpdateHistory] = useState<number[]>([]);

  useEffect(() => {
    if (!perf) return;
    setFpsHistory((prev) => appendHistory(prev, perf.fps));
    setUpdateHistory((prev) => appendHistory(prev, perf.updateMs));
  }, [perf]);

  const fpsMax = useMemo(() => {
    const historyMax = Math.max(60, ...fpsHistory);
    return Math.max(60, Math.ceil(historyMax / 10) * 10);
  }, [fpsHistory]);

  const updateMax = useMemo(() => {
    const historyMax = Math.max(16, ...updateHistory);
    return Math.max(16, Math.ceil(historyMax / 4) * 4);
  }, [updateHistory]);

  const fpsPoints = useMemo(
    () => toLinePoints(fpsHistory, fpsMax),
    [fpsHistory, fpsMax],
  );
  const updatePoints = useMemo(
    () => toLinePoints(updateHistory, updateMax),
    [updateHistory, updateMax],
  );

  return (
    <>
      <SectionLabel>Diagnostics</SectionLabel>
      <AccordionHeader
        label="Performance"
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />
      {open && (
        <PanelBody>
          {perf ? (
            <>
              <KeyValueRow label="fps" value={perf.fps.toFixed(1)} />
              <KeyValueRow label="frame ms" value={perf.frameMs.toFixed(2)} />
              <KeyValueRow label="update ms" value={perf.updateMs.toFixed(2)} />
              <KeyValueRow
                label="terrain ms"
                value={perf.terrainMs.toFixed(2)}
              />
              <HistoryChart
                title="FPS history"
                points={fpsPoints}
                stroke="#22c55e"
                summary={`avg ${average(fpsHistory).toFixed(1)} · max scale ${fpsMax}`}
              />
              <HistoryChart
                title="Runtime history (ms)"
                points={updatePoints}
                stroke="#f59e0b"
                summary={`avg ${average(updateHistory).toFixed(2)} · max scale ${updateMax}ms`}
              />
            </>
          ) : (
            <span style={{ color: "#475569" }}>
              Waiting for runtime perf samples…
            </span>
          )}
        </PanelBody>
      )}
    </>
  );
}

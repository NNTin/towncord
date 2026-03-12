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

export function activeBtn(isActive: boolean): React.CSSProperties {
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

const PANEL_BODY_STYLE: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.5)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 4,
  display: "flex",
  flexDirection: "column",
  fontSize: 11,
  marginLeft: 4,
  padding: "6px 7px",
};

export function SectionLabel({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return <div style={SECTION_LABEL_STYLE}>{children}</div>;
}

export function PanelBody({
  children,
  gap = 6,
}: {
  children: React.ReactNode;
  gap?: number;
}): JSX.Element {
  return <div style={{ ...PANEL_BODY_STYLE, gap }}>{children}</div>;
}

export function KeyValueRow({
  label,
  value,
  gap = 6,
  valueStyle,
}: {
  label: string;
  value: string;
  gap?: number;
  valueStyle?: React.CSSProperties;
}): JSX.Element {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: "#cbd5e1", ...valueStyle }}>{value}</span>
    </div>
  );
}

export function AccordionHeader({
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
      style={{
        ...BUTTON_BASE,
        background: "rgba(255,255,255,0.05)",
        color: "#e2e8f0",
      }}
    >
      {open ? "▾" : "▸"} {label}
    </button>
  );
}

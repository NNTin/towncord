const BUTTON_BASE: React.CSSProperties = {
  border: "1px solid var(--ui-border-muted)",
  borderRadius: 4,
  cursor: "pointer",
  fontFamily: "var(--ui-font-mono)",
  fontSize: 12,
  padding: "5px 8px",
  textAlign: "left",
  transition: "background 0.1s",
  width: "100%",
};

export function activeBtn(isActive: boolean): React.CSSProperties {
  return {
    ...BUTTON_BASE,
    background: isActive ? "var(--ui-accent-bg)" : "var(--ui-surface-muted)",
    border: isActive
      ? "1px solid var(--ui-accent-border)"
      : "1px solid var(--ui-border-muted)",
    color: isActive ? "#fff" : "var(--ui-text-secondary)",
  };
}

const SECTION_LABEL_STYLE: React.CSSProperties = {
  borderTop: "1px solid var(--ui-border-muted)",
  color: "var(--ui-text-muted)",
  fontSize: 11,
  letterSpacing: 1,
  marginTop: 6,
  paddingTop: 6,
  textTransform: "uppercase",
};

const PANEL_BODY_STYLE: React.CSSProperties = {
  background: "var(--ui-panel-bg)",
  border: "1px solid var(--ui-border-muted)",
  borderRadius: 4,
  display: "flex",
  flexDirection: "column",
  color: "var(--ui-text-secondary)",
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
      <span style={{ color: "var(--ui-text-subtle)" }}>{label}</span>
      <span style={{ color: "var(--ui-text-secondary)", ...valueStyle }}>
        {value}
      </span>
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
        background: "var(--ui-surface-muted)",
        color: "var(--ui-text-primary)",
      }}
    >
      {open ? "▾" : "▸"} {label}
    </button>
  );
}

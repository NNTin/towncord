import type { OfficeLayoutDocument } from "../app/officeLayoutDocument";

type Props = {
  canReload: boolean;
  canReset: boolean;
  canSave: boolean;
  error: string | null;
  parseError: string | null;
  isLoading: boolean;
  isSaving: boolean;
  jsonText: string;
  onChangeJsonText: (next: string) => void;
  onReload: () => void;
  onReset: () => void;
  onSave: () => void;
  parsedDocument: OfficeLayoutDocument | null;
  sourcePath: string | null;
  statusText: string;
  updatedAt: string | null;
};

const drawerStyle: React.CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  bottom: 72,
  width: 420,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  background: "rgba(15, 23, 42, 0.96)",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  boxShadow: "0 18px 60px rgba(2, 6, 23, 0.45)",
  padding: 14,
  zIndex: 40,
  pointerEvents: "auto",
};

const actionBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.16)",
  color: "#e2e8f0",
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: 12,
  padding: "6px 9px",
};

function formatTimestamp(value: string | null): string {
  if (!value) return "Unknown";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString();
}

export function OfficeEditorDrawer({
  canReload,
  canReset,
  canSave,
  error,
  parseError,
  isLoading,
  isSaving,
  jsonText,
  onChangeJsonText,
  onReload,
  onReset,
  onSave,
  parsedDocument,
  sourcePath,
  statusText,
  updatedAt,
}: Props): JSX.Element {
  return (
    <aside style={drawerStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ color: "#f8fafc", fontFamily: "monospace", fontSize: 14 }}>
            Office Editor
          </div>
          <div style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 11 }}>
            Canonical repo JSON sync
          </div>
        </div>
        <div
          style={{
            border: "1px solid rgba(96, 165, 250, 0.45)",
            color: "#bfdbfe",
            fontFamily: "monospace",
            fontSize: 11,
            padding: "4px 6px",
          }}
        >
          {statusText}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={!canReload} onClick={onReload} style={actionBtnStyle}>
          {isLoading ? "Loading..." : "Reload"}
        </button>
        <button type="button" disabled={!canReset} onClick={onReset} style={actionBtnStyle}>
          Reset
        </button>
        <button type="button" disabled={!canSave} onClick={onSave} style={actionBtnStyle}>
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          color: "#cbd5e1",
          fontFamily: "monospace",
          fontSize: 11,
        }}
      >
        <div>Grid: {parsedDocument ? `${parsedDocument.cols}x${parsedDocument.rows}` : "--"}</div>
        <div>Tiles: {parsedDocument?.tiles.length ?? 0}</div>
        <div>Furniture: {parsedDocument?.furniture?.length ?? 0}</div>
        <div>Characters: {parsedDocument?.characters?.length ?? 0}</div>
      </div>

      <div style={{ color: "#64748b", fontFamily: "monospace", fontSize: 10, lineHeight: 1.5 }}>
        Source: {sourcePath ?? "Unavailable"}
        <br />
        Updated: {formatTimestamp(updatedAt)}
        <br />
        Graphical office editing will bind to this same document.
      </div>

      {error ? (
        <div style={{ background: "rgba(127, 29, 29, 0.35)", color: "#fecaca", fontFamily: "monospace", fontSize: 11, padding: 8 }}>
          {error}
        </div>
      ) : null}

      {parseError ? (
        <div style={{ background: "rgba(120, 53, 15, 0.35)", color: "#fdba74", fontFamily: "monospace", fontSize: 11, padding: 8 }}>
          JSON error: {parseError}
        </div>
      ) : null}

      <textarea
        value={jsonText}
        onChange={(event) => onChangeJsonText(event.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          resize: "none",
          background: "#020617",
          color: "#e2e8f0",
          border: "1px solid rgba(148, 163, 184, 0.2)",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.45,
          padding: 10,
          whiteSpace: "pre",
        }}
      />
    </aside>
  );
}

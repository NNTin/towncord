import type { OfficeLayoutDocument } from "../../../game";

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
  background: "var(--ui-drawer-bg)",
  border: "1px solid var(--ui-border-strong)",
  boxShadow: "var(--ui-shadow-strong)",
  padding: 14,
  zIndex: 40,
  pointerEvents: "auto",
};

const actionBtnStyle: React.CSSProperties = {
  background: "var(--ui-surface-muted)",
  border: "1px solid var(--ui-border-strong)",
  color: "var(--ui-text-primary)",
  cursor: "pointer",
  fontFamily: "var(--ui-font-mono)",
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
          <div
            style={{
              color: "var(--ui-text-primary)",
              fontFamily: "var(--ui-font-mono)",
              fontSize: 14,
            }}
          >
            Office Editor
          </div>
          <div
            style={{
              color: "var(--ui-text-muted)",
              fontFamily: "var(--ui-font-mono)",
              fontSize: 11,
            }}
          >
            Canonical repo JSON sync
          </div>
        </div>
        <div
          style={{
            border: "1px solid var(--ui-status-border)",
            color: "var(--ui-status-text)",
            fontFamily: "var(--ui-font-mono)",
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
          color: "var(--ui-text-secondary)",
          fontFamily: "var(--ui-font-mono)",
          fontSize: 11,
        }}
      >
        <div>Grid: {parsedDocument ? `${parsedDocument.cols}x${parsedDocument.rows}` : "--"}</div>
        <div>Tiles: {parsedDocument?.tiles.length ?? 0}</div>
        <div>Furniture: {parsedDocument?.furniture?.length ?? 0}</div>
        <div>Characters: {parsedDocument?.characters?.length ?? 0}</div>
      </div>

      <div
        style={{
          color: "var(--ui-text-subtle)",
          fontFamily: "var(--ui-font-mono)",
          fontSize: 10,
          lineHeight: 1.5,
        }}
      >
        Source: {sourcePath ?? "Unavailable"}
        <br />
        Updated: {formatTimestamp(updatedAt)}
        <br />
        Graphical office editing will bind to this same document.
      </div>

      {error ? (
        <div
          style={{
            background: "var(--ui-error-bg)",
            color: "var(--ui-error-text)",
            fontFamily: "var(--ui-font-mono)",
            fontSize: 11,
            padding: 8,
          }}
        >
          {error}
        </div>
      ) : null}

      {parseError ? (
        <div
          style={{
            background: "var(--ui-warning-bg)",
            color: "var(--ui-warning-text)",
            fontFamily: "var(--ui-font-mono)",
            fontSize: 11,
            padding: 8,
          }}
        >
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
          background: "var(--ui-editor-bg)",
          color: "var(--ui-text-primary)",
          border: "1px solid var(--ui-border-strong)",
          fontFamily: "var(--ui-font-mono)",
          fontSize: 12,
          lineHeight: 1.45,
          padding: 10,
          whiteSpace: "pre",
        }}
      />
    </aside>
  );
}

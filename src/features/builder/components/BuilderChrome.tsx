import type { ReactNode } from "react";
import type { DashboardDraft } from "../../../../shared/types/dashboard";
import { publishMetadataLabel } from "../builderPublishModel";

export function BuilderHeader({
  dashboard,
  saveState,
  canUndo,
  canRedo,
  canUseSelection,
  onUndo,
  onRedo,
  onDuplicate,
  onDelete,
  onReset,
  onExport,
  onOpenPublished,
  onPublish,
  onUnpublish
}: {
  dashboard: DashboardDraft;
  saveState: string;
  canUndo: boolean;
  canRedo: boolean;
  canUseSelection: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReset: () => void;
  onExport: () => void;
  onOpenPublished: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  return (
    <header className="builder-header">
      <div className="top-nav">
        <span className="app-mark">EF</span>
        <button type="button">File</button>
        <button type="button">Resize</button>
        <button type="button">Editing</button>
      </div>
      <h1>{dashboard.title}</h1>
      <div className="publish-controls">
        <span className="save-state">{saveState}</span>
        <button type="button" className="secondary" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" className="secondary" onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
        <button type="button" className="secondary" onClick={onDuplicate} disabled={!canUseSelection}>
          Duplicate
        </button>
        <button type="button" className="secondary" onClick={onDelete} disabled={!canUseSelection}>
          Delete
        </button>
        <button type="button" className="secondary" onClick={onReset}>
          Reset
        </button>
        <button type="button" className="secondary" onClick={onExport}>
          Export package
        </button>
        <span className={dashboard.status === "published" ? "status published" : "status"}>{dashboard.status}</span>
        <span className="publish-version-cue">{publishMetadataLabel(dashboard)}</span>
        {dashboard.status === "published" ? (
          <>
            <button type="button" className="secondary" onClick={onOpenPublished}>
              Open report
            </button>
            <button type="button" onClick={onUnpublish}>
              Unpublish
            </button>
          </>
        ) : (
          <button type="button" onClick={onPublish}>
            Publish
          </button>
        )}
      </div>
    </header>
  );
}

export function ToolRail({
  activeView,
  onChange
}: {
  activeView: "pages" | "layers" | "insert" | "data" | "brand";
  onChange: (view: "pages" | "layers" | "insert" | "data" | "brand") => void;
}) {
  return (
    <nav className="tool-rail" aria-label="Design tools">
      <button type="button" className={activeView === "pages" ? "active" : ""} onClick={() => onChange("pages")}>
        <span>▦</span>
        Pages
      </button>
      <button type="button" className={activeView === "insert" ? "active" : ""} onClick={() => onChange("insert")}>
        <span>＋</span>
        Elements
      </button>
      <button type="button" className={activeView === "brand" ? "active" : ""} onClick={() => onChange("brand")}>
        <span>◐</span>
        Brand
      </button>
      <button type="button" className={activeView === "data" ? "active" : ""} onClick={() => onChange("data")}>
        <span>▥</span>
        Charts
      </button>
      <button type="button" className={activeView === "layers" ? "active" : ""} onClick={() => onChange("layers")}>
        <span>☰</span>
        Layers
      </button>
    </nav>
  );
}

export function BuilderPanel({ className, label, children }: { className: string; label: string; children: ReactNode }) {
  return (
    <aside className={className} aria-label={label}>
      {children}
    </aside>
  );
}

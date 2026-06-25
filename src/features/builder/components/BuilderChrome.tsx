import { useEffect, useState, type ReactNode } from "react";
import type { DashboardDraft } from "../../../../shared/types/dashboard";
import {
  buildExportPackageConfirmationView,
  buildExportPackageContextView,
  buildPublishReadinessView,
  buildPublishShareContextView,
  type ExportPackageConfirmationView,
  publishMetadataLabel
} from "../builderPublishModel";

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
  const readiness = buildPublishReadinessView(dashboard);
  const shareContext = buildPublishShareContextView(dashboard);
  const exportContext = buildExportPackageContextView(dashboard, readiness);
  const [exportConfirmation, setExportConfirmation] = useState<ExportPackageConfirmationView | null>(null);

  useEffect(() => {
    if (!exportConfirmation) return undefined;
    const timeout = window.setTimeout(() => setExportConfirmation(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [exportConfirmation]);

  function handleExport() {
    onExport();
    setExportConfirmation(buildExportPackageConfirmationView(dashboard, exportContext));
  }

  return (
    <header className="builder-header">
      <div className="top-nav" aria-label="Workspace identity">
        <span className="app-mark">EF</span>
        <div className="document-title-block">
          <h1>{dashboard.title}</h1>
          <span>{publishMetadataLabel(dashboard)}</span>
        </div>
      </div>
      <div className="publish-controls">
        <div className="quick-edit-controls" aria-label="Quick edit actions">
          <span className="save-state">{saveState}</span>
          <button type="button" className="secondary" onClick={onUndo} disabled={!canUndo}>Undo</button>
          <button type="button" className="secondary" onClick={onRedo} disabled={!canRedo}>Redo</button>
          <button type="button" className="secondary" onClick={onDuplicate} disabled={!canUseSelection}>Duplicate</button>
          <button type="button" className="secondary" onClick={onDelete} disabled={!canUseSelection}>Delete</button>
        </div>
        {exportConfirmation && (
          <div className={`export-package-confirmation ${exportConfirmation.status}`} role="status">
            <strong>{exportConfirmation.label}</strong>
            <small>{exportConfirmation.helper}</small>
          </div>
        )}
        <details className="delivery-status-menu">
          <summary>
            <span className={dashboard.status === "published" ? "status published" : "status"}>{dashboard.status}</span>
            <strong>{readiness.passedCount}/{readiness.totalCount} ready</strong>
          </summary>
          <div className="delivery-status-popover">
            <div className={`publish-readiness-cue ${readiness.status}`} aria-label="Publish readiness">
              <strong>{readiness.label}</strong>
              <span>{readiness.passedCount}/{readiness.totalCount} checks</span>
              <small>{readiness.helper}</small>
            </div>
            <div className={`publish-share-context ${shareContext.status}`} aria-label="Publish and share context">
              <strong>{shareContext.label}</strong>
              <span>{shareContext.helper}</span>
              <small>{shareContext.viewerLabel}</small>
              <small>{shareContext.exportLabel}</small>
            </div>
            <div className={`export-package-context ${exportContext.status}`} aria-label="Export package context">
              <strong>{exportContext.label}</strong>
              <span>{exportContext.packageLabel}</span>
              <small>{exportContext.readinessLabel}</small>
              <small>{exportContext.helper}</small>
            </div>
          </div>
        </details>
        <button type="button" className="secondary" onClick={onReset}>Reset</button>
        <button type="button" className="secondary" onClick={handleExport}>Export</button>
        {dashboard.status === "published" ? (
          <>
            <button type="button" className="secondary" onClick={onOpenPublished}>Open</button>
            <button type="button" onClick={onUnpublish}>Unpublish</button>
          </>
        ) : (
          <button type="button" onClick={onPublish}>Publish</button>
        )}
      </div>
    </header>
  );
}

export function WorkspaceModeStrip({
  activeView,
  pageTitle,
  selectionLabel
}: {
  activeView: "pages" | "layers" | "insert" | "data" | "brand";
  pageTitle: string;
  selectionLabel: string;
}) {
  const modeLabel =
    activeView === "data"
      ? "Explore"
      : activeView === "pages" || activeView === "layers"
        ? "Navigate"
        : activeView === "brand"
          ? "Brand"
          : "Compose";

  return (
    <div className="workspace-mode-strip" aria-label="Workspace mode">
      <div>
        <span>{modeLabel}</span>
        <strong>{pageTitle}</strong>
      </div>
      <small>{selectionLabel}</small>
    </div>
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

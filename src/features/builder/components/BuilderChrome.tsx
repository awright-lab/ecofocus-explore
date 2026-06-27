import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import type { DashboardDraft } from "../../../../shared/types/dashboard";
import {
  buildExportPackageConfirmationView,
  buildExportPackageContextView,
  buildPublishReadinessView,
  buildPublishShareContextView,
  type ExportPackageConfirmationView,
  publishMetadataLabel
} from "../builderPublishModel";
import { buildDocumentSaveStateView, normalizeDocumentTitle } from "./documentIdentityModel";

type WorkspaceProductMode = "data" | "design" | "story" | "dashboard" | "report" | "present";
type ChromeIconName =
  | WorkspaceProductMode
  | "undo"
  | "redo"
  | "duplicate"
  | "delete"
  | "help"
  | "bell";

const workspaceProductModes: Array<{
  id: WorkspaceProductMode;
  label: string;
  helper: string;
}> = [
  { id: "data", label: "Data", helper: "Library and source setup" },
  { id: "design", label: "Design", helper: "Brand and composition tools" },
  { id: "story", label: "Story", helper: "Active authoring workspace" },
  { id: "dashboard", label: "Dashboard", helper: "Structured view scaffold" },
  { id: "report", label: "Report", helper: "Report assembly scaffold" },
  { id: "present", label: "Present", helper: "Presentation scaffold" }
];

function ChromeIcon({ icon }: { icon: ChromeIconName }) {
  const paths: Record<ChromeIconName, ReactNode> = {
    data: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
    design: <><path d="M12 4 20 12l-8 8-8-8z" /><circle cx="12" cy="12" r="2.2" /></>,
    story: <><rect x="5" y="5" width="14" height="14" rx="2" /><path d="M8 9h8M8 13h5M8 17h7" /></>,
    dashboard: <><rect x="4" y="5" width="7" height="6" rx="1.5" /><rect x="13" y="5" width="7" height="6" rx="1.5" /><rect x="4" y="13" width="16" height="6" rx="1.5" /></>,
    report: <><path d="M7 4h7l4 4v12H7z" /><path d="M14 4v5h5M9 13h6M9 16h6" /></>,
    present: <><rect x="4" y="5" width="16" height="12" rx="2" /><path d="m11 9 4 2.5-4 2.5zM12 17v3" /></>,
    undo: <><path d="M9 8H5V4" /><path d="M5 8c2.3-2.5 5.8-3.2 8.8-1.7 3.1 1.6 4.5 5.2 3.2 8.4-1.2 3-4.4 4.8-7.6 4.1" /></>,
    redo: <><path d="M15 8h4V4" /><path d="M19 8c-2.3-2.5-5.8-3.2-8.8-1.7-3.1 1.6-4.5 5.2-3.2 8.4 1.2 3 4.4 4.8 7.6 4.1" /></>,
    duplicate: <><rect x="8" y="8" width="10" height="10" rx="2" /><path d="M6 14H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1" /></>,
    delete: <><path d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.5 2.5 0 1 1 4.3 1.8c-.8.8-1.7 1.2-1.8 2.5" /><path d="M12 17h.01" /></>,
    bell: <><path d="M18 16H6c1.3-1.4 1.7-3 1.7-5a4.3 4.3 0 1 1 8.6 0c0 2 .4 3.6 1.7 5Z" /><path d="M10 19a2.2 2.2 0 0 0 4 0" /></>
  };

  return (
    <svg className="chrome-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[icon]}
      </g>
    </svg>
  );
}

export function BuilderHeader({
  dashboard,
  saveState,
  onRenameDashboard,
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
  onRenameDashboard: (title: string) => void;
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
  const saveStateView = buildDocumentSaveStateView(saveState);
  const [exportConfirmation, setExportConfirmation] = useState<ExportPackageConfirmationView | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(dashboard.title);
  const [activeProductMode, setActiveProductMode] = useState<WorkspaceProductMode>("story");

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(dashboard.title);
    }
  }, [dashboard.title, isEditingTitle]);

  useEffect(() => {
    if (!exportConfirmation) return undefined;
    const timeout = window.setTimeout(() => setExportConfirmation(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [exportConfirmation]);

  function handleExport() {
    onExport();
    setExportConfirmation(buildExportPackageConfirmationView(dashboard, exportContext));
  }

  function commitTitle() {
    const nextTitle = normalizeDocumentTitle(titleDraft, dashboard.title);
    setIsEditingTitle(false);
    setTitleDraft(nextTitle);
    if (nextTitle !== dashboard.title) {
      onRenameDashboard(nextTitle);
    }
  }

  function cancelTitleEdit() {
    setIsEditingTitle(false);
    setTitleDraft(dashboard.title);
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTitle();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelTitleEdit();
    }
  }

  return (
    <header className="builder-header">
      <div className="top-nav" aria-label="Product navigation">
        <span className="app-mark">IC</span>
        <strong className="app-wordmark">InsightCanvas</strong>
        <nav className="workspace-product-nav" aria-label="Workspace modes">
          {workspaceProductModes.map((mode) => (
            <button
              type="button"
              key={mode.id}
              className={activeProductMode === mode.id ? "active" : ""}
              aria-pressed={activeProductMode === mode.id}
              title={mode.helper}
              onClick={() => setActiveProductMode(mode.id)}
            >
              <span aria-hidden="true"><ChromeIcon icon={mode.id} /></span>
              {mode.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="document-identity-shell" aria-label="Document identity">
        <div className="document-title-block">
          {isEditingTitle ? (
            <input
              aria-label="Document title"
              className="document-title-input"
              value={titleDraft}
              onBlur={commitTitle}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={handleTitleKeyDown}
              autoFocus
            />
          ) : (
            <button type="button" className="document-title-button" onClick={() => setIsEditingTitle(true)}>
              <h1>{dashboard.title}</h1>
              <span aria-hidden="true">Edit</span>
            </button>
          )}
          <div className="document-identity-meta">
            <span>{publishMetadataLabel(dashboard)}</span>
            {activeProductMode !== "story" && <span>{workspaceProductModes.find((mode) => mode.id === activeProductMode)?.helper}</span>}
            <span className={`save-state ${saveStateView.tone}`} aria-live="polite">
              {saveStateView.showSpinner && <span className="save-state-spinner" aria-hidden="true" />}
              <strong>{saveStateView.label}</strong>
              <small>{saveStateView.helper}</small>
            </span>
          </div>
        </div>
      </div>
      <div className="publish-controls">
        <div className="quick-edit-controls" aria-label="Quick edit actions">
          <button type="button" className="icon-button" aria-label="Undo" title="Undo" onClick={onUndo} disabled={!canUndo}><ChromeIcon icon="undo" /></button>
          <button type="button" className="icon-button" aria-label="Redo" title="Redo" onClick={onRedo} disabled={!canRedo}><ChromeIcon icon="redo" /></button>
          <button type="button" className="icon-button" aria-label="Duplicate selection" title="Duplicate" onClick={onDuplicate} disabled={!canUseSelection}><ChromeIcon icon="duplicate" /></button>
          <button type="button" className="icon-button" aria-label="Delete selection" title="Delete" onClick={onDelete} disabled={!canUseSelection}><ChromeIcon icon="delete" /></button>
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
        <button type="button" className="icon-button" aria-label="Help" title="Help"><ChromeIcon icon="help" /></button>
        <button type="button" className="icon-button" aria-label="Notifications" title="Notifications"><ChromeIcon icon="bell" /></button>
        <button type="button" className="icon-button avatar-button" aria-label="Account">AM</button>
        <button type="button" className="secondary quiet-header-action" onClick={onReset}>Reset</button>
        {dashboard.status === "published" ? (
          <>
            <button type="button" className="secondary" onClick={onOpenPublished}>Open</button>
            <button type="button" className="share-action" onClick={onUnpublish}>Unshare</button>
          </>
        ) : (
          <button type="button" className="share-action" onClick={onPublish}>Share</button>
        )}
        <button type="button" className="export-action" onClick={handleExport}>Export ▾</button>
      </div>
    </header>
  );
}

export function WorkspaceModeStrip({
  activeView,
  pageTitle,
  saveState,
  selectionLabel
}: {
  activeView: "pages" | "layers" | "insert" | "data" | "brand";
  pageTitle: string;
  saveState: string;
  selectionLabel: string;
}) {
  const saveStateView = buildDocumentSaveStateView(saveState);
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
      <div className="workspace-strip-document">
        <button type="button" className="workspace-back-button" aria-label="Back to story overview">‹</button>
        <div>
          <strong>{pageTitle}</strong>
          <span>{modeLabel} workspace</span>
        </div>
      </div>
      <div className="workspace-strip-status">
        <span>Draft</span>
        <small className={`workspace-save-state ${saveStateView.tone}`} aria-live="polite">
          {saveStateView.showSpinner && <span className="save-state-spinner" aria-hidden="true" />}
          {saveStateView.label}
        </small>
        <small>{selectionLabel}</small>
      </div>
      <div className="workspace-strip-tools" aria-label="Canvas view controls">
        <button type="button" title="Desktop preview">▭</button>
        <button type="button" title="Mobile preview">▯</button>
        <button type="button" title="Zoom out">−</button>
        <button type="button" title="Zoom in">+</button>
        <button type="button" title="Grid">▦</button>
      </div>
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

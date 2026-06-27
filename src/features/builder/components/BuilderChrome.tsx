import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import type { DashboardDraft } from "../../../../shared/types/dashboard";
import {
  buildExportPackageConfirmationView,
  buildExportPackageContextView,
  buildPublishReadinessView,
  type ExportPackageConfirmationView
} from "../builderPublishModel";
import { buildDocumentSaveStateView, normalizeDocumentTitle } from "./documentIdentityModel";

type WorkspaceProductMode = "data" | "design" | "story" | "dashboard" | "report" | "present";
type ChromeIconName =
  | WorkspaceProductMode
  | "brand"
  | "undo"
  | "redo"
  | "duplicate"
  | "delete"
  | "share"
  | "export"
  | "help"
  | "bell"
  | "back"
  | "pencil"
  | "desktop"
  | "mobile"
  | "zoomOut"
  | "zoomIn"
  | "grid";

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
    brand: <><path d="M8.5 6.5 4.8 17a2.2 2.2 0 0 0 3.4 2.4l3.8-3.1" /><path d="m15.5 6.5 3.7 10.5a2.2 2.2 0 0 1-3.4 2.4L12 16.3" /><circle cx="12" cy="8" r="3.2" /><path d="M9.8 10.4 7.2 17.2M14.2 10.4l2.6 6.8" /></>,
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
    share: <><circle cx="8" cy="8" r="3" /><path d="M16 21v-2a4 4 0 0 0-8 0v2" /><path d="M17 8h4M19 6v4" /></>,
    export: <><path d="M12 15V4" /><path d="m8 8 4-4 4 4" /><rect x="5" y="13" width="14" height="7" rx="2" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.5 2.5 0 1 1 4.3 1.8c-.8.8-1.7 1.2-1.8 2.5" /><path d="M12 17h.01" /></>,
    bell: <><path d="M18 16H6c1.3-1.4 1.7-3 1.7-5a4.3 4.3 0 1 1 8.6 0c0 2 .4 3.6 1.7 5Z" /><path d="M10 19a2.2 2.2 0 0 0 4 0" /></>,
    back: <path d="m15 18-6-6 6-6" />,
    pencil: <><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z" /><path d="m14 7 3 3" /></>,
    desktop: <><rect x="4" y="5" width="16" height="12" rx="2" /><path d="M9 20h6M12 17v3" /></>,
    mobile: <><rect x="8" y="3" width="8" height="18" rx="2" /><path d="M11.5 18h1" /></>,
    zoomOut: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="M15 15l5 5M8 10.5h5" /></>,
    zoomIn: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="M15 15l5 5M8 10.5h5M10.5 8v5" /></>,
    grid: <><path d="M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z" /></>
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
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExport,
  onOpenPublished,
  onPublish,
  onUnpublish
}: {
  dashboard: DashboardDraft;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onOpenPublished: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const readiness = buildPublishReadinessView(dashboard);
  const exportContext = buildExportPackageContextView(dashboard, readiness);
  const [exportConfirmation, setExportConfirmation] = useState<ExportPackageConfirmationView | null>(null);
  const [activeProductMode, setActiveProductMode] = useState<WorkspaceProductMode>("story");

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
      <div className="top-nav" aria-label="Product navigation">
        <span className="app-mark"><ChromeIcon icon="brand" /></span>
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
      <div className="publish-controls">
        <div className="quick-edit-controls" aria-label="Quick edit actions">
          <button type="button" className="icon-button header-plain-icon" aria-label="Undo" title="Undo" onClick={onUndo} disabled={!canUndo}><ChromeIcon icon="undo" /></button>
          <button type="button" className="icon-button header-plain-icon" aria-label="Redo" title="Redo" onClick={onRedo} disabled={!canRedo}><ChromeIcon icon="redo" /></button>
        </div>
        {exportConfirmation && (
          <div className={`export-package-confirmation ${exportConfirmation.status}`} role="status">
            <strong>{exportConfirmation.label}</strong>
            <small>{exportConfirmation.helper}</small>
          </div>
        )}
        {dashboard.status === "published" ? (
          <>
            <button type="button" className="secondary" onClick={onOpenPublished}>Open</button>
            <button type="button" className="share-action" onClick={onUnpublish}><ChromeIcon icon="share" />Unshare</button>
          </>
        ) : (
          <button type="button" className="share-action" onClick={onPublish}><ChromeIcon icon="share" />Share</button>
        )}
        <button type="button" className="export-action" onClick={handleExport}><ChromeIcon icon="export" />Export ▾</button>
        <button type="button" className="icon-button header-plain-icon" aria-label="Help" title="Help"><ChromeIcon icon="help" /></button>
        <button type="button" className="icon-button header-plain-icon" aria-label="Notifications" title="Notifications"><ChromeIcon icon="bell" /></button>
        <button type="button" className="icon-button avatar-button" aria-label="Account">AM</button>
      </div>
    </header>
  );
}

export function WorkspaceModeStrip({
  pageTitle,
  saveState,
  onRenameDashboard,
  selectionLabel
}: {
  pageTitle: string;
  saveState: string;
  onRenameDashboard: (title: string) => void;
  selectionLabel: string;
}) {
  const saveStateView = buildDocumentSaveStateView(saveState);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(pageTitle);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(pageTitle);
    }
  }, [pageTitle, isEditingTitle]);

  function commitTitle() {
    const nextTitle = normalizeDocumentTitle(titleDraft, pageTitle);
    setIsEditingTitle(false);
    setTitleDraft(nextTitle);
    if (nextTitle !== pageTitle) {
      onRenameDashboard(nextTitle);
    }
  }

  function cancelTitleEdit() {
    setIsEditingTitle(false);
    setTitleDraft(pageTitle);
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
    <div className="workspace-mode-strip" aria-label="Workspace mode">
      <div className="workspace-strip-document">
        <button type="button" className="workspace-back-button" aria-label="Back to story overview"><ChromeIcon icon="back" /></button>
        <div>
          {isEditingTitle ? (
            <input
              aria-label="Document title"
              className="workspace-title-input"
              value={titleDraft}
              onBlur={commitTitle}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={handleTitleKeyDown}
              autoFocus
            />
          ) : (
            <button type="button" className="workspace-title-button" onClick={() => setIsEditingTitle(true)}>
              <strong>{pageTitle}</strong>
              <span className="workspace-title-edit" aria-hidden="true"><ChromeIcon icon="pencil" /></span>
            </button>
          )}
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
        <button type="button" title="Desktop preview"><ChromeIcon icon="desktop" /></button>
        <button type="button" title="Mobile preview"><ChromeIcon icon="mobile" /></button>
        <button type="button" title="Zoom out"><ChromeIcon icon="zoomOut" /></button>
        <button type="button" title="Zoom in"><ChromeIcon icon="zoomIn" /></button>
        <button type="button" title="Grid"><ChromeIcon icon="grid" /></button>
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

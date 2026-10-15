import {
  memo,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Atom,
  Check,
  ChevronDown,
  MoreHorizontal,
  PanelRight,
  Search,
  Bell,
  BookOpenText,
  ChevronLeft,
  CircleHelp,
  Copy,
  Database,
  FileText,
  Grid3X3,
  ImagePlus,
  Layers3,
  LayoutDashboard,
  Library,
  Monitor,
  Palette,
  Pencil,
  Plus,
  Presentation,
  Redo2,
  Smartphone,
  Trash2,
  Undo2,
  Upload,
  UsersRound,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import type {
  DashboardDraft,
  DashboardReportRecord,
} from "../../../../shared/types/dashboard";
import {
  buildExportPackageConfirmationView,
  buildExportPackageContextView,
  buildPublishReadinessView,
  type ExportPackageConfirmationView,
} from "../builderPublishModel";
import {
  buildDocumentSaveStateView,
  normalizeDocumentTitle,
} from "./documentIdentityModel";
import type { CoreExportTarget } from "../../export/coreDocumentExports";

export type WorkspaceProductMode =
  "data" | "design" | "story" | "dashboard" | "report" | "present";
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
  {
    id: "dashboard",
    label: "Dashboard",
    helper: "Analytical interaction framing",
  },
  { id: "report", label: "Report", helper: "Authored document framing" },
  { id: "present", label: "Present", helper: "Presentation preview framing" },
];

export type OutcomeWorkspaceMode = Extract<
  WorkspaceProductMode,
  "dashboard" | "report" | "present"
>;

export function outcomeModeView(mode: WorkspaceProductMode): {
  mode: OutcomeWorkspaceMode | null;
  label: string;
  helper: string;
  canvasLabel: string;
} {
  if (mode === "dashboard") {
    return {
      mode,
      label: "Dashboard framing",
      helper: "Review your evidence and analytical context.",
      canvasLabel: "Analytical dashboard review",
    };
  }

  if (mode === "report") {
    return {
      mode,
      label: "Report framing",
      helper: "Review the page sequence and story before export.",
      canvasLabel: "Report page review",
    };
  }

  if (mode === "present") {
    return {
      mode,
      label: "Present preview",
      helper: "Review your presentation before sharing.",
      canvasLabel: "Presentation preview",
    };
  }

  return {
    mode: null,
    label: "Story workspace",
    helper:
      "Compose analytical evidence, narrative blocks, and reusable report sections.",
    canvasLabel: "Story canvas",
  };
}

function ChromeIcon({ icon }: { icon: ChromeIconName }) {
  const icons: Record<ChromeIconName, LucideIcon> = {
    brand: Atom,
    data: Database,
    design: Palette,
    story: BookOpenText,
    dashboard: LayoutDashboard,
    report: FileText,
    present: Presentation,
    undo: Undo2,
    redo: Redo2,
    duplicate: Copy,
    delete: Trash2,
    share: UsersRound,
    export: Upload,
    help: CircleHelp,
    bell: Bell,
    back: ChevronLeft,
    pencil: Pencil,
    desktop: Monitor,
    mobile: Smartphone,
    zoomOut: ZoomOut,
    zoomIn: ZoomIn,
    grid: Grid3X3,
  };
  const Icon = icons[icon];

  return <Icon className="chrome-icon" aria-hidden="true" strokeWidth={1.9} />;
}

export const BuilderHeader = memo(function BuilderHeader({
  dashboard,
  activeProductMode,
  setActiveProductMode,
  reports,
  activeReportId,
  onOpenReport,
  onCreateReport,
  onDuplicateReport,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExport,
  onOpenPublished,
  onPublish,
  onUnpublish,
  onHome,
  onSearch,
  onHelp,
}: {
  dashboard: DashboardDraft;
  activeProductMode: WorkspaceProductMode;
  setActiveProductMode: (mode: WorkspaceProductMode) => void;
  reports: DashboardReportRecord[];
  activeReportId: string;
  onOpenReport: (reportId: string) => void;
  onCreateReport: () => void;
  onDuplicateReport: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExport: (target: CoreExportTarget) => void | Promise<void>;
  onOpenPublished: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onHome: () => void;
  onSearch: () => void;
  onHelp: () => void;
}) {
  const readiness = useMemo(
    () => buildPublishReadinessView(dashboard),
    [dashboard],
  );
  const exportContext = useMemo(
    () => buildExportPackageContextView(dashboard, readiness),
    [dashboard, readiness],
  );
  const [exportConfirmation, setExportConfirmation] =
    useState<ExportPackageConfirmationView | null>(null);
  const activeOutcomeMode = useMemo(
    () => outcomeModeView(activeProductMode),
    [activeProductMode],
  );

  useEffect(() => {
    if (!exportConfirmation) return undefined;
    const timeout = window.setTimeout(() => setExportConfirmation(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [exportConfirmation]);

  async function handleExport(target: CoreExportTarget) {
    await onExport(target);
    setExportConfirmation(
      buildExportPackageConfirmationView(dashboard, exportContext, target),
    );
  }

  return (
    <header className="builder-header">
      <div className="top-nav" aria-label="Product navigation">
        <button
          type="button"
          className="studio-brand"
          onClick={onHome}
          title="Back to workspace"
        >
          <span className="app-mark">
            <ChromeIcon icon="brand" />
          </span>
          <strong>
            InsightCanvas<span> / studio</span>
          </strong>
        </button>
        <details className="studio-document-menu">
          <summary aria-label="Document menu">
            <MoreHorizontal size={20} />
          </summary>
          <div className="studio-menu-content">
            <span className="studio-menu-label">Your workspace</span>
            <label>
              Switch report
              <select
                aria-label="Switch report"
                value={activeReportId}
                onChange={(event) => onOpenReport(event.target.value)}
              >
                {reports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={onCreateReport}>
              <Plus size={16} />
              New report
            </button>
            <button type="button" onClick={onDuplicateReport}>
              <Copy size={16} />
              Duplicate report
            </button>
            <button type="button" onClick={onHome}>
              <Library size={16} />
              All reports
            </button>
          </div>
        </details>
      </div>
      <nav className="workspace-product-nav" aria-label="Workspace modes">
        {workspaceProductModes
          .filter((mode) => ["data", "design", "story"].includes(mode.id))
          .map((mode) => (
            <button
              type="button"
              key={mode.id}
              data-mode={mode.id}
              className={activeProductMode === mode.id ? "active" : ""}
              aria-pressed={activeProductMode === mode.id}
              onClick={() => setActiveProductMode(mode.id)}
            >
              <ChromeIcon icon={mode.id} />
              {mode.id === "story" ? "Compose" : mode.label}
            </button>
          ))}
      </nav>
      <div className="publish-controls">
        <button
          type="button"
          className="studio-search-trigger"
          aria-label="Find a tool"
          onClick={onSearch}
          title="Find a tool"
        >
          <Search size={16} />
          <span>Find a tool</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="quick-edit-controls" aria-label="Quick edit actions">
          <button
            type="button"
            className="icon-button header-plain-icon"
            aria-label="Undo"
            title="Undo"
            onClick={onUndo}
            disabled={!canUndo}
          >
            <ChromeIcon icon="undo" />
          </button>
          <button
            type="button"
            className="icon-button header-plain-icon"
            aria-label="Redo"
            title="Redo"
            onClick={onRedo}
            disabled={!canRedo}
          >
            <ChromeIcon icon="redo" />
          </button>
        </div>
        {exportConfirmation && (
          <div
            className={`export-package-confirmation ${exportConfirmation.status}`}
            role="status"
          >
            <strong>{exportConfirmation.label}</strong>
            <small>{exportConfirmation.helper}</small>
          </div>
        )}
        <details className="studio-preview-menu">
          <summary>
            <Presentation size={16} />
            <span>Preview</span>
            <ChevronDown size={13} />
          </summary>
          <div className="studio-menu-content">
            <span className="studio-menu-label">Review your deliverable</span>
            {workspaceProductModes
              .filter((mode) =>
                ["dashboard", "report", "present"].includes(mode.id),
              )
              .map((mode) => (
                <button
                  type="button"
                  key={mode.id}
              data-mode={mode.id}
                  onClick={(event) => {
                    setActiveProductMode(mode.id);
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                  }}
                >
                  <ChromeIcon icon={mode.id} />
                  {mode.label}
                  {activeProductMode === mode.id && <Check size={14} />}
                </button>
              ))}
            {dashboard.publishMetadata.publishCount > 0 && (
              <button type="button" onClick={onOpenPublished}>
                <ChromeIcon icon="share" />
                Published snapshot
              </button>
            )}
            {dashboard.status === "published" && (
              <button type="button" onClick={onUnpublish}>
                Return to draft
              </button>
            )}
          </div>
        </details>
        <button type="button" className="share-action" onClick={onPublish}>
          <ChromeIcon icon="share" />
          {dashboard.status === "published" ? "Update snapshot" : "Share"}
        </button>
        <details className="export-menu">
          <summary className="export-action">
            <ChromeIcon icon="export" />
            Export
            <ChevronDown size={13} />
          </summary>
          <div>
            <button
              type="button"
              onClick={(event) => {
                event.currentTarget.closest("details")?.removeAttribute("open");
                void handleExport("pptx");
              }}
            >
              PowerPoint (.pptx)
            </button>
            <button type="button" onClick={() => void handleExport("pdf")}>
              PDF document (.pdf)
            </button>
            <button type="button" onClick={() => void handleExport("xlsx")}>
              Excel tables (.xlsx)
            </button>
            <button type="button" onClick={() => void handleExport("json")}>
              JSON package
            </button>
          </div>
        </details>
        <button
          type="button"
          className="icon-button header-plain-icon"
          aria-label="Help"
          title="Studio guide"
          onClick={onHelp}
        >
          <ChromeIcon icon="help" />
        </button>
      </div>
      {activeOutcomeMode.mode && (
        <div
          className={`outcome-mode-frame ${activeOutcomeMode.mode}`}
          role="status"
        >
          <strong>{activeOutcomeMode.label}</strong>
          <span>{activeOutcomeMode.helper}</span>
        </div>
      )}
    </header>
  );
});

const zoomOptions = Array.from({ length: 26 }, (_, index) => 35 + index * 5);

export const WorkspaceModeStrip = memo(function WorkspaceModeStrip({
  pageTitle,
  saveState,
  canvasZoom,
  showCanvasGrid,
  onBackToWorkspace,
  onRenameDashboard,
  onZoomChange,
  onToggleCanvasGrid,
  selectionLabel,
  inspectorOpen,
  onToggleInspector,
  onFit,
}: {
  pageTitle: string;
  saveState: string;
  canvasZoom: number;
  showCanvasGrid: boolean;
  onBackToWorkspace: () => void;
  onRenameDashboard: (title: string) => void;
  onZoomChange: (zoom: number) => void;
  onToggleCanvasGrid: () => void;
  selectionLabel: string;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  onFit: () => void;
}) {
  const saveStateView = useMemo(
    () => buildDocumentSaveStateView(saveState),
    [saveState],
  );
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
        <button
          type="button"
          className="workspace-back-button"
          aria-label="Back to workspace home"
          onClick={onBackToWorkspace}
        >
          <ChromeIcon icon="back" />
        </button>
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
            <button
              type="button"
              className="workspace-title-button"
              onClick={() => setIsEditingTitle(true)}
            >
              <strong>{pageTitle}</strong>
              <span className="workspace-title-edit" aria-hidden="true">
                <ChromeIcon icon="pencil" />
              </span>
            </button>
          )}
        </div>
      </div>
      <div className="workspace-strip-status">
        <span className="studio-draft-label">Draft</span>
        <small
          className={`workspace-save-state ${saveStateView.tone}`}
          aria-live="polite"
        >
          {saveStateView.showSpinner && (
            <span className="save-state-spinner" aria-hidden="true" />
          )}
          {saveStateView.label}
        </small>
        <small className="studio-selection-label" title={selectionLabel}>
          {selectionLabel}
        </small>
      </div>
      <div className="workspace-strip-tools" aria-label="Canvas view controls">
        <button type="button" title="Fit page to workspace" onClick={onFit}>
          <ChromeIcon icon="desktop" />
        </button>
        <button
          type="button"
          title="Zoom out"
          onClick={() => onZoomChange(canvasZoom - 10)}
        >
          <ChromeIcon icon="zoomOut" />
        </button>
        <label className="workspace-zoom-select" aria-label="Canvas zoom">
          <select
            value={canvasZoom}
            onChange={(event) => onZoomChange(Number(event.target.value))}
          >
            {zoomOptions.map((zoom) => (
              <option value={zoom} key={zoom}>
                {zoom}%
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          title="Zoom in"
          onClick={() => onZoomChange(canvasZoom + 10)}
        >
          <ChromeIcon icon="zoomIn" />
        </button>
        <button
          type="button"
          className={showCanvasGrid ? "active" : ""}
          title={showCanvasGrid ? "Hide grid" : "Show grid"}
          aria-pressed={showCanvasGrid}
          onClick={onToggleCanvasGrid}
        >
          <ChromeIcon icon="grid" />
        </button>
        <button
          type="button"
          className={
            inspectorOpen
              ? "active studio-inspector-toggle"
              : "studio-inspector-toggle"
          }
          aria-label="Toggle properties"
          title="Properties"
          aria-pressed={inspectorOpen}
          onClick={onToggleInspector}
        >
          <PanelRight size={17} />
        </button>
      </div>
    </div>
  );
});

export function ToolRail({
  activeView,
  onChange,
}: {
  activeView: "pages" | "layers" | "insert" | "data" | "brand";
  onChange: (view: "pages" | "layers" | "insert" | "data" | "brand") => void;
}) {
  return (
    <nav className="tool-rail" aria-label="Design tools">
      <button
        type="button"
        className={activeView === "pages" ? "active" : ""}
        onClick={() => onChange("pages")}
      >
        <span>
          <Library
            className="tool-rail-icon"
            aria-hidden="true"
            strokeWidth={1.9}
          />
        </span>
        Pages
      </button>
      <button
        type="button"
        className={activeView === "insert" ? "active" : ""}
        onClick={() => onChange("insert")}
      >
        <span>
          <Plus className="tool-rail-icon" aria-hidden="true" strokeWidth={2} />
        </span>
        Elements
      </button>
      <button
        type="button"
        className={activeView === "brand" ? "active" : ""}
        onClick={() => onChange("brand")}
      >
        <span>
          <Palette
            className="tool-rail-icon"
            aria-hidden="true"
            strokeWidth={1.9}
          />
        </span>
        Brand
      </button>
      <button
        type="button"
        className={activeView === "data" ? "active" : ""}
        onClick={() => onChange("data")}
      >
        <span>
          <ImagePlus
            className="tool-rail-icon"
            aria-hidden="true"
            strokeWidth={1.9}
          />
        </span>
        Charts
      </button>
      <button
        type="button"
        className={activeView === "layers" ? "active" : ""}
        onClick={() => onChange("layers")}
      >
        <span>
          <Layers3
            className="tool-rail-icon"
            aria-hidden="true"
            strokeWidth={1.9}
          />
        </span>
        Layers
      </button>
    </nav>
  );
}

export function BuilderPanel({
  className,
  label,
  children,
}: {
  className: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <aside className={className} aria-label={label}>
      {children}
    </aside>
  );
}

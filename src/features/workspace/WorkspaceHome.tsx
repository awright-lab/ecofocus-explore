import type { ReactNode } from "react";
import type { DashboardReportRecord, DashboardWorkspace, PublishedDashboardSnapshot } from "../../../shared/types/dashboard";
import {
  createNewReportFromSeed,
  duplicateReportRecord,
  findPublishedSnapshot,
  makeBuilderReportPath,
  makePublishedViewerPath,
  markReportOpened,
  saveDashboardWorkspace
} from "../document/workspacePersistence";

type ReportLibraryState = "draft" | "published" | "changed";
type HomeIconName = "brand" | "plus" | "copy" | "open" | "published" | "draft" | "clock" | "deck";

interface ReportLibraryItem {
  report: DashboardReportRecord;
  latestSnapshot: PublishedDashboardSnapshot | null;
  state: ReportLibraryState;
  stateLabel: string;
  stateHelper: string;
  updatedLabel: string;
  openedLabel: string;
  pageCount: number;
  tileCount: number;
  versionLabel: string;
}

function HomeIcon({ icon }: { icon: HomeIconName }) {
  const paths: Record<HomeIconName, ReactNode> = {
    brand: <><path d="M8.5 6.5 4.8 17a2.2 2.2 0 0 0 3.4 2.4l3.8-3.1" /><path d="m15.5 6.5 3.7 10.5a2.2 2.2 0 0 1-3.4 2.4L12 16.3" /><circle cx="12" cy="8" r="3.2" /><path d="M9.8 10.4 7.2 17.2M14.2 10.4l2.6 6.8" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    copy: <><rect x="8" y="8" width="10" height="10" rx="2" /><path d="M6 14H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1" /></>,
    open: <><path d="M7 17 17 7M10 7h7v7" /><rect x="4" y="4" width="16" height="16" rx="3" /></>,
    published: <><circle cx="12" cy="12" r="8" /><path d="m8.8 12.3 2.1 2.2 4.4-5" /></>,
    draft: <><path d="M7 4h7l4 4v12H7z" /><path d="M14 4v5h5M9 14h6" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
    deck: <><rect x="4" y="5" width="16" height="12" rx="2" /><path d="M8 9h8M8 13h5M12 17v3" /></>
  };

  return (
    <svg className="workspace-home-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[icon]}
      </g>
    </svg>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function buildReportLibraryItem(workspace: DashboardWorkspace, report: DashboardReportRecord): ReportLibraryItem {
  const latestSnapshot = findPublishedSnapshot(workspace, report.id, report.draft.publishMetadata.publishedSnapshotId);
  const hasPublishedVersion = Boolean(latestSnapshot || report.draft.publishMetadata.publishCount);
  const state: ReportLibraryState =
    !hasPublishedVersion
      ? "draft"
      : report.draft.status === "published"
        ? "published"
        : "changed";
  const pageCount = report.draft.pages.length;
  const tileCount = report.draft.pages.reduce((count, page) => count + page.tiles.length, 0);

  return {
    report,
    latestSnapshot,
    state,
    stateLabel: state === "draft" ? "Draft only" : state === "published" ? "Published" : "Draft changes",
    stateHelper:
      state === "draft"
        ? "No published snapshot yet."
        : state === "published"
          ? "Latest draft matches the current published build."
          : "Published snapshot exists, with newer local draft edits.",
    updatedLabel: formatDateTime(report.updatedAt),
    openedLabel: formatDateTime(report.lastOpenedAt),
    pageCount,
    tileCount,
    versionLabel: latestSnapshot?.versionLabel ?? report.draft.publishMetadata.versionLabel ?? "Draft"
  };
}

export function WorkspaceHome({
  workspace,
  onWorkspaceChange
}: {
  workspace: DashboardWorkspace;
  onWorkspaceChange: (workspace: DashboardWorkspace) => void;
}) {
  const reports = workspace.reports
    .filter((report) => !report.archived)
    .map((report) => buildReportLibraryItem(workspace, report))
    .sort((a, b) => new Date(b.report.updatedAt).getTime() - new Date(a.report.updatedAt).getTime());
  const publishedCount = reports.filter((item) => item.state === "published" || item.state === "changed").length;
  const draftOnlyCount = reports.filter((item) => item.state === "draft").length;
  const recentReports = reports.slice(0, 3);

  function navigate(path: string) {
    window.location.hash = path.replace(/^#/, "");
  }

  function openReport(reportId: string) {
    const nextWorkspace = markReportOpened(workspace, reportId);
    onWorkspaceChange(nextWorkspace);
    saveDashboardWorkspace(nextWorkspace);
    navigate(makeBuilderReportPath(reportId));
  }

  function createReport() {
    const next = createNewReportFromSeed(workspace);
    onWorkspaceChange(next.workspace);
    saveDashboardWorkspace(next.workspace);
    navigate(makeBuilderReportPath(next.report.id));
  }

  function duplicateReport(report: DashboardReportRecord) {
    const next = duplicateReportRecord(workspace, report);
    onWorkspaceChange(next.workspace);
    saveDashboardWorkspace(next.workspace);
    navigate(makeBuilderReportPath(next.report.id));
  }

  function openPublished(item: ReportLibraryItem) {
    const snapshot = item.latestSnapshot;
    if (!snapshot) return;
    navigate(makePublishedViewerPath(snapshot.reportId, snapshot.id));
  }

  return (
    <main className="workspace-home-shell">
      <header className="workspace-home-header">
        <div className="workspace-home-brand">
          <span className="workspace-home-mark"><HomeIcon icon="brand" /></span>
          <strong>InsightCanvas</strong>
        </div>
        <div className="workspace-home-header__actions">
          <span>Local workspace</span>
          <button type="button" className="workspace-home-primary" onClick={createReport}>
            <HomeIcon icon="plus" />
            New report
          </button>
        </div>
      </header>

      <section className="workspace-home-hero">
        <div>
          <p className="workspace-home-kicker">Workspace Home</p>
          <h1>Reports, drafts, and published builds in one place.</h1>
          <p>
            Open a report to continue editing, duplicate an existing deck, or review the latest published snapshot without dropping directly into the canvas.
          </p>
        </div>
        <div className="workspace-home-stats" aria-label="Workspace summary">
          <article>
            <strong>{reports.length}</strong>
            <span>Total reports</span>
          </article>
          <article>
            <strong>{publishedCount}</strong>
            <span>Published builds</span>
          </article>
          <article>
            <strong>{draftOnlyCount}</strong>
            <span>Draft only</span>
          </article>
        </div>
      </section>

      <section className="workspace-home-body">
        <aside className="workspace-home-sidebar" aria-label="Recent reports">
          <div className="workspace-home-panel">
            <div className="workspace-home-panel__header">
              <span><HomeIcon icon="clock" /></span>
              <strong>Recent reports</strong>
            </div>
            <div className="workspace-home-recent-list">
              {recentReports.map((item) => (
                <button type="button" key={item.report.id} onClick={() => openReport(item.report.id)}>
                  <span className={`workspace-home-state-dot ${item.state}`} />
                  <span>
                    <strong>{item.report.title}</strong>
                    <small>Updated {item.updatedLabel}</small>
                  </span>
                </button>
              ))}
              {!recentReports.length && <p>No reports yet. Start with a new report.</p>}
            </div>
          </div>

          <div className="workspace-home-panel quiet">
            <div className="workspace-home-panel__header">
              <span><HomeIcon icon="deck" /></span>
              <strong>Product layers</strong>
            </div>
            <p>Home manages report identity. The editor handles canvas authoring. Published links show snapshot previews.</p>
          </div>
        </aside>

        <section className="workspace-report-library" aria-label="Report library">
          <div className="workspace-report-library__header">
            <div>
              <p className="workspace-home-kicker">Report Library</p>
              <h2>Your InsightCanvas reports</h2>
            </div>
            <button type="button" className="workspace-home-secondary" onClick={createReport}>
              <HomeIcon icon="plus" />
              Create new
            </button>
          </div>

          <div className="workspace-report-grid">
            {reports.map((item) => (
              <article className={`workspace-report-card ${item.state}`} key={item.report.id}>
                <div className="workspace-report-card__preview">
                  <span className="workspace-report-card__mini-title" />
                  <span className="workspace-report-card__mini-kpis" />
                  <span className="workspace-report-card__mini-chart" />
                  <span className="workspace-report-card__mini-note" />
                </div>
                <div className="workspace-report-card__content">
                  <div className="workspace-report-card__title-row">
                    <h3>{item.report.title}</h3>
                    <span className={`workspace-report-state ${item.state}`}>
                      <HomeIcon icon={item.state === "draft" ? "draft" : "published"} />
                      {item.stateLabel}
                    </span>
                  </div>
                  <p>{item.stateHelper}</p>
                  <dl className="workspace-report-meta">
                    <div>
                      <dt>Updated</dt>
                      <dd>{item.updatedLabel}</dd>
                    </div>
                    <div>
                      <dt>Opened</dt>
                      <dd>{item.openedLabel}</dd>
                    </div>
                    <div>
                      <dt>Pages</dt>
                      <dd>{item.pageCount}</dd>
                    </div>
                    <div>
                      <dt>Tiles</dt>
                      <dd>{item.tileCount}</dd>
                    </div>
                    <div>
                      <dt>Published</dt>
                      <dd>{item.latestSnapshot ? item.versionLabel : "None"}</dd>
                    </div>
                  </dl>
                  <div className="workspace-report-card__actions">
                    <button type="button" className="workspace-home-primary compact" onClick={() => openReport(item.report.id)}>
                      <HomeIcon icon="open" />
                      Open report
                    </button>
                    <button type="button" className="workspace-home-secondary compact" onClick={() => duplicateReport(item.report)}>
                      <HomeIcon icon="copy" />
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="workspace-home-secondary compact"
                      disabled={!item.latestSnapshot}
                      onClick={() => openPublished(item)}
                    >
                      <HomeIcon icon="published" />
                      Published view
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!reports.length && (
            <div className="workspace-home-empty">
              <HomeIcon icon="deck" />
              <h2>No reports yet</h2>
              <p>Create the first local draft to start building a data-backed story canvas.</p>
              <button type="button" className="workspace-home-primary" onClick={createReport}>Create report</button>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

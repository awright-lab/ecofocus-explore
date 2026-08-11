import { useRef, useState, type ReactNode } from "react";
import type { DashboardReportRecord, DashboardWorkspace, PublishedDashboardSnapshot } from "../../../shared/types/dashboard";
import type { DatasetConnectionProfile, DatasetConnectionVerificationReport } from "../../../shared/types/dataSource";
import { importedDatasetImportFeedback, importDatasetForWorkspace } from "../data/importDatasetWorkspaceService";
import { buildImportedDatasetStructureSummary, importedFieldTypeLabel } from "../data/datasetModelingModel";
import { buildDatasetConnectionProfiles, datasetConnectionOption, datasetConnectionOptions } from "../data/datasetConnectionModel";
import {
  createNewReportFromSeed,
  duplicateReportRecord,
  findPublishedSnapshot,
  makeBuilderReportPath,
  makePublishedViewerPath,
  markReportOpened,
  removeWorkspaceDatasetConnection,
  saveDashboardWorkspace,
  upsertWorkspaceDatasetConnection,
  upsertWorkspaceImportedDataset
} from "../document/workspacePersistence";

type ReportLibraryState = "draft" | "published" | "changed";
type HomeIconName =
  | "brand"
  | "plus"
  | "copy"
  | "open"
  | "published"
  | "draft"
  | "clock"
  | "deck"
  | "dataset"
  | "field"
  | "insight"
  | "story"
  | "deliverable"
  | "spark";

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
    deck: <><rect x="4" y="5" width="16" height="12" rx="2" /><path d="M8 9h8M8 13h5M12 17v3" /></>,
    dataset: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
    field: <><path d="M5 19V9" /><path d="M12 19V5" /><path d="M19 19v-7" /><path d="M3.5 19h17" /></>,
    insight: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8.8 14.5a6 6 0 1 1 6.4 0c-.8.5-1.2 1.4-1.2 2.5h-4c0-1.1-.4-2-1.2-2.5Z" /></>,
    story: <><path d="M5 5h14v14H5z" /><path d="M8 9h8M8 13h5M8 17h7" /></>,
    deliverable: <><path d="M7 4h7l4 4v12H7z" /><path d="M14 4v5h5" /><path d="M10 14h5M10 17h4" /></>,
    spark: <><path d="M12 3l1.8 5.1L19 10l-5.2 1.9L12 17l-1.8-5.1L5 10l5.2-1.9z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></>
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

function isConnectionVerificationError(
  payload: DatasetConnectionVerificationReport | { error?: string; details?: string[] }
): payload is { error?: string; details?: string[] } {
  return "error" in payload || !("status" in payload);
}

export function WorkspaceHome({
  workspace,
  onWorkspaceChange
}: {
  workspace: DashboardWorkspace;
  onWorkspaceChange: (workspace: DashboardWorkspace) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ tone: "success" | "error"; label: string } | null>(null);
  const [showConnectionOptions, setShowConnectionOptions] = useState(false);
  const [selectedConnectionProvider, setSelectedConnectionProvider] = useState<DatasetConnectionProfile["provider"]>("snowflake");
  const [connectionVerification, setConnectionVerification] = useState<DatasetConnectionVerificationReport | null>(null);
  const [isVerifyingConnection, setIsVerifyingConnection] = useState(false);
  const reports = workspace.reports
    .filter((report) => !report.archived)
    .map((report) => buildReportLibraryItem(workspace, report))
    .sort((a, b) => new Date(b.report.updatedAt).getTime() - new Date(a.report.updatedAt).getTime());
  const publishedCount = reports.filter((item) => item.state === "published" || item.state === "changed").length;
  const draftOnlyCount = reports.filter((item) => item.state === "draft").length;
  const recentReports = reports.slice(0, 3);
  const importedDatasets = [...(workspace.importedDatasets ?? [])].sort(
    (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
  );
  const latestReport = reports[0] ?? null;
  const usableDatasets = importedDatasets.filter((dataset) => dataset.rowCount > 0);
  const metadataRichDatasets = importedDatasets.filter((dataset) => dataset.importMetadata?.metadataQuality === "metadata_rich");
  const savedDatasetConnections = workspace.datasetConnections ?? [];
  const liveDatasetSources = workspace.liveDatasetSources ?? [];
  const connectionProfileOptions = buildDatasetConnectionProfiles();
  const selectedConnectionOption = datasetConnectionOption(selectedConnectionProvider);
  const selectedConnectionProfile = savedDatasetConnections.find((item) => item.provider === selectedConnectionProvider);
  const availableConnectionCount = datasetConnectionOptions.length - savedDatasetConnections.length;
  const guidedSteps = [
    {
      icon: "dataset" as const,
      label: "1",
      title: importedDatasets.length ? "Your study data is ready" : "Import your study",
      body: importedDatasets.length
        ? `${importedDatasets[0].title} is available with ${importedDatasets[0].rowCount.toLocaleString()} rows and ${importedDatasets[0].fieldCount.toLocaleString()} fields.`
        : "Start with a CSV, XLSX, or SAV file. We will turn it into a study library with readable fields.",
      action: importedDatasets.length ? "Review study data" : "Import dataset",
      onClick: () => importedDatasets.length && latestReport ? openReport(latestReport.report.id) : fileInputRef.current?.click(),
      ready: importedDatasets.length > 0
    },
    {
      icon: "insight" as const,
      label: "2",
      title: "Find the story",
      body: usableDatasets.length
        ? "Create a first table or chart from your imported fields, then use insights and story blocks to explain what matters."
        : "Once rows are available, create plain tables first so the numbers are clear before designing the story.",
      action: latestReport ? "Open analysis workspace" : "Create report",
      onClick: () => latestReport ? openReport(latestReport.report.id) : createReport(),
      ready: usableDatasets.length > 0
    },
    {
      icon: "deliverable" as const,
      label: "3",
      title: "Create deliverables",
      body: "Shape the same research into a report, presentation, dashboard, or export-ready client asset.",
      action: latestReport ? "Continue report" : "Start report",
      onClick: () => latestReport ? openReport(latestReport.report.id) : createReport(),
      ready: reports.length > 0
    }
  ];

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

  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    setIsImporting(true);
    setImportFeedback(null);
    try {
      const result = await importDatasetForWorkspace(file);
      if (result.error || !result.dataset) {
        setImportFeedback({ tone: "error", label: result.error ?? "Dataset import failed." });
        return;
      }
      const nextWorkspace = upsertWorkspaceImportedDataset(workspace, result.dataset);
      onWorkspaceChange(nextWorkspace);
      saveDashboardWorkspace(nextWorkspace);
      setImportFeedback({
        tone: "success",
        label: importedDatasetImportFeedback(result.dataset, result.storage.warning)
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function planConnection(provider: typeof datasetConnectionOptions[number]["provider"]) {
    const profile = connectionProfileOptions.find((item) => item.provider === provider);
    if (!profile) return;
    const nextWorkspace = upsertWorkspaceDatasetConnection(workspace, {
      ...profile,
      updatedAt: new Date().toISOString()
    });
    onWorkspaceChange(nextWorkspace);
    saveDashboardWorkspace(nextWorkspace);
    setShowConnectionOptions(true);
    setSelectedConnectionProvider(provider);
    setImportFeedback({
      tone: "success",
      label: `${profile.label} setup is saved as a planned source. Credentials and live sync come in the next connection pass.`
    });
  }

  async function verifySelectedConnection() {
    setIsVerifyingConnection(true);
    setConnectionVerification(null);
    try {
      const response = await fetch("/.netlify/functions/dataset-connection-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedConnectionProvider,
          connectionId: selectedConnectionProfile?.id
        })
      });
      const payload = await response.json() as DatasetConnectionVerificationReport | { error?: string; details?: string[] };
      if (!response.ok) {
        const errorPayload = isConnectionVerificationError(payload) ? payload : {};
        setConnectionVerification({
          provider: selectedConnectionProvider,
          connectionId: selectedConnectionProfile?.id,
          status: "failed",
          statusLabel: errorPayload.error ?? "Verification failed",
          checkedAt: new Date().toISOString(),
          diagnostics: errorPayload.details ?? ["The server readiness check failed."],
          nextStep: "Check Netlify function logs and server environment variables."
        });
        return;
      }
      if (isConnectionVerificationError(payload)) return;
      setConnectionVerification(payload);
    } catch (error) {
      setConnectionVerification({
        provider: selectedConnectionProvider,
        connectionId: selectedConnectionProfile?.id,
        status: "failed",
        statusLabel: "Verification unavailable",
        checkedAt: new Date().toISOString(),
        diagnostics: [error instanceof Error ? error.message : "The server readiness check could not be reached."],
        nextStep: "Run the app through Netlify Dev or deploy the verification function before checking readiness."
      });
    } finally {
      setIsVerifyingConnection(false);
    }
  }

  function removeConnectionPlan(connection: DatasetConnectionProfile) {
    const shouldRemove = window.confirm(`Remove the planned ${connection.label} connection? This only removes the setup plan; no data or credentials will be affected.`);
    if (!shouldRemove) return;
    const nextWorkspace = removeWorkspaceDatasetConnection(workspace, connection.id);
    onWorkspaceChange(nextWorkspace);
    saveDashboardWorkspace(nextWorkspace);
    setImportFeedback({ tone: "success", label: `${connection.label} setup plan removed.` });
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
          <p className="workspace-home-kicker">Research Publishing Workspace</p>
          <h1>Turn raw research into clear stories and client-ready deliverables.</h1>
          <p>
            Start with the study, find the strongest insight, then shape it into a report, dashboard, presentation, or export without leaving the workspace.
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
          <article>
            <strong>{metadataRichDatasets.length || importedDatasets.length}</strong>
            <span>{metadataRichDatasets.length ? "Labeled studies" : "Datasets"}</span>
          </article>
        </div>
      </section>

      <section className="workspace-home-body">
        <aside className="workspace-home-sidebar" aria-label="Recent reports">
          <div className="workspace-home-panel">
            <div className="workspace-home-panel__header">
              <span><HomeIcon icon="spark" /></span>
              <strong>Start here</strong>
            </div>
            <p>Most users should begin with one of these steps. Advanced modeling and provider details stay inside the editor when needed.</p>
            <button type="button" className="workspace-home-primary" onClick={importedDatasets.length ? createReport : () => fileInputRef.current?.click()}>
              <HomeIcon icon={importedDatasets.length ? "deck" : "dataset"} />
              {importedDatasets.length ? "Create deliverable" : "Import study data"}
            </button>
          </div>

          <div className="workspace-home-panel quiet">
            <div className="workspace-home-panel__header">
              <span><HomeIcon icon="clock" /></span>
              <strong>Recent work</strong>
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

          <div className="workspace-home-panel">
            <div className="workspace-home-panel__header">
              <span><HomeIcon icon="dataset" /></span>
              <strong>Study data</strong>
            </div>
            <p>Import a study file once, then use its fields to create tables, charts, insights, and deliverables.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.sav,text/csv"
              className="visually-hidden"
              onChange={(event) => void handleImportFile(event.target.files?.[0])}
            />
            <button type="button" className="workspace-home-secondary" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
              <HomeIcon icon="plus" />
              {isImporting ? "Importing..." : "Import dataset"}
            </button>
            <button type="button" className="workspace-home-secondary" onClick={() => setShowConnectionOptions((current) => !current)}>
              <HomeIcon icon="dataset" />
              Connect database
            </button>
            {importFeedback && <small className={`workspace-home-import-feedback ${importFeedback.tone}`}>{importFeedback.label}</small>}
          </div>
        </aside>

        <section className="workspace-guided-library" aria-label="Guided research workflow">
          <div className="workspace-report-library__header">
            <div>
              <p className="workspace-home-kicker">Guided Workflow</p>
              <h2>What do you want to do next?</h2>
            </div>
            <button type="button" className="workspace-home-secondary" onClick={() => latestReport ? openReport(latestReport.report.id) : createReport()}>
              <HomeIcon icon="open" />
              Open workspace
            </button>
          </div>
          <div className="workspace-guided-grid">
            {guidedSteps.map((step) => (
              <article className={step.ready ? "workspace-guided-card ready" : "workspace-guided-card"} key={step.title}>
                <div className="workspace-guided-card__top">
                  <span><HomeIcon icon={step.icon} /></span>
                  <em>{step.label}</em>
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <button type="button" className={step.ready ? "workspace-home-primary compact" : "workspace-home-secondary compact"} onClick={step.onClick}>
                  {step.action}
                </button>
              </article>
            ))}
          </div>
          <div className="workspace-deliverable-strip" aria-label="Deliverable shortcuts">
            {[
              "Executive summary",
              "PowerPoint deck",
              "PDF report",
              "Dashboard",
              "Social graphic",
              "Infographic"
            ].map((item) => (
              <button type="button" key={item} onClick={() => latestReport ? openReport(latestReport.report.id) : createReport()}>
                <HomeIcon icon="deliverable" />
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="workspace-report-library" aria-label="Report library">
          <div className="workspace-report-library__header">
            <div>
              <p className="workspace-home-kicker">Report Library</p>
              <h2>Reports and drafts</h2>
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

        <section className="workspace-dataset-library" aria-label="Imported dataset library">
          <div className="workspace-report-library__header">
            <div>
              <p className="workspace-home-kicker">Study Library</p>
              <h2>Available datasets</h2>
            </div>
            <button type="button" className="workspace-home-secondary" onClick={() => fileInputRef.current?.click()}>
              <HomeIcon icon="plus" />
              Import data
            </button>
            <button type="button" className="workspace-home-secondary" onClick={() => setShowConnectionOptions((current) => !current)}>
              <HomeIcon icon="dataset" />
              Connect database
            </button>
          </div>
          {showConnectionOptions && (
            <div className="workspace-connection-grid" aria-label="Database connection setup options">
              {datasetConnectionOptions.map((option) => {
                const planned = savedDatasetConnections.find((item) => item.provider === option.provider);
                return (
                  <article className={planned ? "workspace-connection-card planned" : "workspace-connection-card"} key={option.provider}>
                    <div>
                      <span><HomeIcon icon="dataset" /></span>
                      <strong>{option.label}</strong>
                    </div>
                    <p>{option.description}</p>
                <small>{option.bestFor} · {planned?.statusLabel ?? option.statusLabel}</small>
                <em>{planned ? "Setup plan saved" : "Not planned yet"}</em>
                <button
                      type="button"
                      className="workspace-home-secondary compact"
                      onClick={() => {
                        setSelectedConnectionProvider(option.provider);
                        setConnectionVerification(null);
                        setShowConnectionOptions(true);
                      }}
                    >
                      {planned ? "View setup" : "View requirements"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
          {showConnectionOptions && (
            <aside className="workspace-connection-detail" aria-label={`${selectedConnectionOption.label} setup detail`}>
              <div>
                <p className="workspace-home-kicker">Connection Setup</p>
                <h3>{selectedConnectionOption.label}</h3>
                <span>{selectedConnectionProfile ? "Planned source" : "Available connector"}</span>
              </div>
              <p>{selectedConnectionOption.description}</p>
              <div className="workspace-connection-readiness">
                <strong>{selectedConnectionProfile ? selectedConnectionProfile.statusLabel : "Not configured"}</strong>
                <span>
                  {selectedConnectionProfile
                    ? "This provider is saved as a setup plan. It is not connected until server-side credentials and verification are added."
                    : "Review the requirements, then save a setup plan when you are ready to configure this source later."}
                </span>
              </div>
              <div className="workspace-connection-detail__columns">
                <section>
                  <strong>Needed before live sync</strong>
                  <ul>
                    {selectedConnectionOption.setupRequirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <strong>Current boundary</strong>
                  <p>{selectedConnectionOption.nextStep}</p>
                  <small>No credentials are stored in the browser. Live verification will run server-side when that adapter is added.</small>
                </section>
              </div>
              <div className="workspace-connection-detail__actions">
                <button
                  type="button"
                  className="workspace-home-primary compact"
                  onClick={() => planConnection(selectedConnectionProvider)}
                >
                  {selectedConnectionProfile ? "Setup plan saved" : "Save setup plan"}
                </button>
                <button type="button" className="workspace-home-secondary compact" onClick={() => void verifySelectedConnection()} disabled={isVerifyingConnection}>
                  {isVerifyingConnection ? "Checking..." : "Check server readiness"}
                </button>
              </div>
              {connectionVerification && (
                <section className={`workspace-connection-verification ${connectionVerification.status}`}>
                  <div>
                    <strong>{connectionVerification.statusLabel}</strong>
                    <small>{formatDateTime(connectionVerification.checkedAt)}</small>
                  </div>
                  <ul>
                    {connectionVerification.diagnostics.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p>{connectionVerification.nextStep}</p>
                </section>
              )}
            </aside>
          )}
          {savedDatasetConnections.length > 0 && (
            <section className="workspace-connection-plans" aria-label="Planned database connections">
              <div className="workspace-connection-plans__header">
                <div>
                  <p className="workspace-home-kicker">Planned Sources</p>
                  <h3>Database setup plans</h3>
                </div>
                <span>
                  {savedDatasetConnections.length} planned
                  {liveDatasetSources.length ? ` · ${liveDatasetSources.length} live source${liveDatasetSources.length === 1 ? "" : "s"}` : ""}
                  {availableConnectionCount > 0 ? ` · ${availableConnectionCount} available` : ""}
                </span>
              </div>
              <div className="workspace-connection-plan-list">
                {savedDatasetConnections.map((connection) => {
                  const option = datasetConnectionOption(connection.provider);
                  return (
                    <article className="workspace-connection-plan-row" key={connection.id}>
                      <span><HomeIcon icon="dataset" /></span>
                      <div>
                        <strong>{connection.label}</strong>
                        <small>{connection.statusLabel} · {option.bestFor}</small>
                        <em>Waiting for server-side verification and credential setup.</em>
                      </div>
                      <button
                        type="button"
                        className="workspace-home-secondary compact"
                        onClick={() => {
                          setSelectedConnectionProvider(connection.provider);
                          setConnectionVerification(null);
                          setShowConnectionOptions(true);
                        }}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="workspace-home-secondary compact danger"
                        onClick={() => removeConnectionPlan(connection)}
                      >
                        Remove
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          <div className="workspace-dataset-grid">
            {importedDatasets.map((dataset) => {
              const summary = buildImportedDatasetStructureSummary(dataset);
              return (
                <article className="workspace-dataset-card" key={dataset.id}>
                    <div className="workspace-dataset-card__header">
                      <span><HomeIcon icon="dataset" /></span>
                      <div>
                        <h3>{dataset.title}</h3>
                        <small>{dataset.fileName} · {dataset.importMetadata?.formatLabel ?? dataset.fileType.toUpperCase()} · imported {formatDateTime(dataset.importedAt)}</small>
                      </div>
                    </div>
                    <div className="workspace-dataset-structures">
                      <span>{dataset.rowCount > 0 ? "Ready for analysis" : "Labels imported"}</span>
                      <span>{dataset.remote?.provider ? "Saved for this workspace" : "Local draft"}</span>
                    </div>
                    <dl className="workspace-dataset-stats">
                      <div>
                        <dt>Rows</dt>
                        <dd>{dataset.rowCount.toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt>Fields</dt>
                        <dd>{dataset.fieldCount}</dd>
                      </div>
                      <div>
                        <dt>Modeled</dt>
                        <dd>{summary.filters.length + summary.segments.length + summary.banners.length}</dd>
                      </div>
                    </dl>
                    <div className="workspace-dataset-structures">
                      <span>{dataset.importMetadata?.metadataQuality === "metadata_rich" ? "Survey labels found" : dataset.importMetadata?.metadataQuality === "structured" ? "Structured workbook" : "Basic field list"}</span>
                      {dataset.importMetadata?.sheetName && <span>Sheet: {dataset.importMetadata.sheetName}</span>}
                      <span>{summary.filterLabel}</span>
                      <span>{summary.segmentLabel}</span>
                      <span>{summary.bannerLabel}</span>
                    </div>
                    {dataset.importStatus?.detail && <p>{dataset.importStatus.detail.replace(/Netlify Database/g, "workspace storage")}</p>}
                    <div className="workspace-dataset-fields">
                      {dataset.fields.slice(0, 6).map((field) => (
                        <span key={field.id}>
                          <HomeIcon icon="field" />
                          {field.label}
                          <em>{importedFieldTypeLabel(field.type)}</em>
                        </span>
                      ))}
                    </div>
                    <p>{dataset.notes[0] ?? "Initial variable catalog generated from imported columns."}</p>
                </article>
              );
            })}
          </div>
          {!importedDatasets.length && (
            <div className="workspace-home-empty compact">
              <HomeIcon icon="dataset" />
              <h2>No imported datasets yet</h2>
              <p>Import a CSV, XLSX, or classic SPSS SAV file to create a workspace dataset and initial field catalog.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

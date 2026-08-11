import { storageKey } from "../builder/builderConstants";
import { normalizeDashboard, normalizeImportedDataset, normalizeImportedDatasetField } from "./documentModel";
import { initialDashboard } from "./documentSeeds";
import type { DatasetConnectionProfile } from "../../../shared/types/dataSource";
import type { DashboardDraft, DashboardReportRecord, DashboardWorkspace, ImportedDatasetField, ImportedDatasetRecord, PublishedDashboardSnapshot } from "../../../shared/types/dashboard";

export const workspaceStorageKey = "insightcanvas_report_workspace_v1";

export type WorkspaceRoute =
  | { mode: "home"; reportId: null }
  | { mode: "builder"; reportId: string | null }
  | { mode: "published"; reportId: string | null; snapshotId: string | null };

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makePublishedViewerPath(reportId: string, snapshotId: string) {
  return `#/published/${encodeURIComponent(reportId)}/${encodeURIComponent(snapshotId)}`;
}

export function makeWorkspaceHomePath() {
  return "#/";
}

export function makeBuilderReportPath(reportId: string) {
  return `#/reports/${encodeURIComponent(reportId)}`;
}

export function parseWorkspaceRoute(hash = window.location.hash): WorkspaceRoute {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map((part) => decodeURIComponent(part));

  if (parts[0] === "published") {
    return {
      mode: "published",
      reportId: parts[1] ?? null,
      snapshotId: parts[2] ?? null
    };
  }

  if (parts[0] === "reports") {
    return {
      mode: "builder",
      reportId: parts[1] ?? null
    };
  }

  return { mode: "home", reportId: null };
}

function cloneDashboard(dashboard: DashboardDraft): DashboardDraft {
  return JSON.parse(JSON.stringify(dashboard)) as DashboardDraft;
}

function mergeImportedDatasets(...groups: Array<Array<Partial<ImportedDatasetRecord>> | undefined>) {
  const datasetMap = new Map<string, ImportedDatasetRecord>();
  groups.flatMap((group) => group ?? []).forEach((dataset, index) => {
    const normalized = normalizeImportedDataset(dataset, index);
    datasetMap.set(normalized.id, normalized);
  });
  return Array.from(datasetMap.values()).sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
}

export function createReportRecord(dashboard: DashboardDraft, createdAt = nowIso()): DashboardReportRecord {
  const normalized = normalizeDashboard(dashboard);
  return {
    id: normalized.id,
    title: normalized.title,
    draft: normalized,
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: createdAt
  };
}

function defaultWorkspace(): DashboardWorkspace {
  const report = createReportRecord(initialDashboard);
  return {
    id: "local_workspace",
    label: "InsightCanvas Workspace",
    activeReportId: report.id,
    datasetConnections: [],
    liveDatasetSources: [],
    importedDatasets: [],
    reports: [report],
    publishedSnapshots: []
  };
}

function migrateLegacyDashboard(): DashboardWorkspace | null {
  try {
    const savedDashboard = window.localStorage.getItem(storageKey);
    if (!savedDashboard) return null;
    const dashboard = normalizeDashboard(JSON.parse(savedDashboard) as DashboardDraft);
    const report = createReportRecord(dashboard);
    return {
      id: "local_workspace",
      label: "InsightCanvas Workspace",
      activeReportId: report.id,
      datasetConnections: [],
      liveDatasetSources: [],
      importedDatasets: dashboard.importedDatasets,
      reports: [report],
      publishedSnapshots: []
    };
  } catch {
    return null;
  }
}

export function normalizeDashboardWorkspace(workspace: Partial<DashboardWorkspace> | null | undefined): DashboardWorkspace {
  if (!workspace?.reports?.length) return defaultWorkspace();

  const reports = workspace.reports.map((report, index) => {
    const normalizedDraft = normalizeDashboard(report.draft ?? initialDashboard);
    const id = report.id || normalizedDraft.id || `report_${index + 1}`;
    const createdAt = report.createdAt ?? nowIso();
    return {
      ...report,
      id,
      title: report.title || normalizedDraft.title || "Untitled report",
      draft: { ...normalizedDraft, id },
      createdAt,
      updatedAt: report.updatedAt ?? createdAt,
      lastOpenedAt: report.lastOpenedAt ?? createdAt
    };
  });
  const activeReportId =
    workspace.activeReportId && reports.some((report) => report.id === workspace.activeReportId)
      ? workspace.activeReportId
      : reports[0].id;
  const publishedSnapshots = (workspace.publishedSnapshots ?? []).map((snapshot) => ({
    ...snapshot,
    dashboard: normalizeDashboard(snapshot.dashboard)
  }));
  const importedDatasets = mergeImportedDatasets(
    workspace.importedDatasets,
    reports.flatMap((report) => report.draft.importedDatasets ?? [])
  );

  return {
    id: workspace.id ?? "local_workspace",
    label: workspace.label ?? "InsightCanvas Workspace",
    activeReportId,
    datasetConnections: workspace.datasetConnections ?? [],
    liveDatasetSources: workspace.liveDatasetSources ?? [],
    importedDatasets,
    reports,
    publishedSnapshots
  };
}

export function loadDashboardWorkspace(): DashboardWorkspace {
  try {
    const savedWorkspace = window.localStorage.getItem(workspaceStorageKey);
    if (savedWorkspace) {
      return normalizeDashboardWorkspace(JSON.parse(savedWorkspace) as DashboardWorkspace);
    }
  } catch {
    // Fall through to legacy migration/default workspace.
  }

  return migrateLegacyDashboard() ?? defaultWorkspace();
}

function compactImportedDatasetForDraft(dataset: ImportedDatasetRecord): ImportedDatasetRecord {
  const isRemoteNetlifyDataset = dataset.remote?.provider === "netlify";
  const fieldPreview = isRemoteNetlifyDataset ? dataset.fields.slice(0, 80) : dataset.fields;
  const remoteFieldNote = isRemoteNetlifyDataset && dataset.fields.length > fieldPreview.length
    ? "Full imported field metadata is loaded from Netlify Database as needed in the Data Library."
    : null;
  return {
    ...dataset,
    fields: fieldPreview,
    rows: [],
    previewRows: dataset.previewRows.slice(0, 25),
    notes: [
      ...dataset.notes,
      dataset.notes.includes("Stored compactly in report drafts; full imported rows are kept at workspace level.")
        ? null
        : "Stored compactly in report drafts; full imported rows are kept at workspace level.",
      remoteFieldNote && !dataset.notes.includes(remoteFieldNote) ? remoteFieldNote : null
    ].filter(Boolean) as string[]
  };
}

function compactDashboardForWorkspaceStorage(dashboard: DashboardDraft): DashboardDraft {
  return {
    ...dashboard,
    importedDatasets: []
  };
}

function compactWorkspaceForStorage(workspace: DashboardWorkspace): DashboardWorkspace {
  return {
    ...workspace,
    importedDatasets: workspace.importedDatasets.map(compactImportedDatasetForDraft),
    reports: workspace.reports.map((report) => ({
      ...report,
      draft: compactDashboardForWorkspaceStorage(report.draft)
    })),
    publishedSnapshots: workspace.publishedSnapshots.map((snapshot) => ({
      ...snapshot,
      dashboard: compactDashboardForWorkspaceStorage(snapshot.dashboard)
    }))
  };
}

function isStorageQuotaError(error: unknown) {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
}

export function saveDashboardWorkspace(workspace: DashboardWorkspace) {
  const compactWorkspace = compactWorkspaceForStorage(workspace);
  try {
    window.localStorage.setItem(workspaceStorageKey, JSON.stringify(compactWorkspace));
    return true;
  } catch (error) {
    if (!isStorageQuotaError(error)) {
      console.warn("Unable to save InsightCanvas workspace.", error);
      return false;
    }
  }

  try {
    window.localStorage.setItem(workspaceStorageKey, JSON.stringify(compactWorkspace));
    console.warn("Saved compact InsightCanvas workspace after local storage quota was exceeded.");
    return true;
  } catch (error) {
    console.warn("Unable to save InsightCanvas workspace because local browser storage is full.", error);
    return false;
  }
}

export function upsertWorkspaceImportedDataset(workspace: DashboardWorkspace, dataset: ImportedDatasetRecord): DashboardWorkspace {
  return {
    ...workspace,
    importedDatasets: mergeImportedDatasets([dataset], workspace.importedDatasets)
  };
}

export function removeWorkspaceImportedDataset(workspace: DashboardWorkspace, datasetId: string): DashboardWorkspace {
  return {
    ...workspace,
    importedDatasets: workspace.importedDatasets.filter((dataset) => dataset.id !== datasetId)
  };
}

export function upsertWorkspaceDatasetConnection(workspace: DashboardWorkspace, connection: DatasetConnectionProfile): DashboardWorkspace {
  const connections = workspace.datasetConnections ?? [];
  return {
    ...workspace,
    datasetConnections: [
      connection,
      ...connections.filter((item) => item.id !== connection.id && item.provider !== connection.provider)
    ]
  };
}

export function removeWorkspaceDatasetConnection(workspace: DashboardWorkspace, connectionId: string): DashboardWorkspace {
  return {
    ...workspace,
    datasetConnections: (workspace.datasetConnections ?? []).filter((connection) => connection.id !== connectionId),
    liveDatasetSources: (workspace.liveDatasetSources ?? []).filter((source) => source.connectionId !== connectionId)
  };
}

export function updateWorkspaceImportedDatasetField(
  workspace: DashboardWorkspace,
  datasetId: string,
  fieldId: string,
  updates: Partial<Pick<ImportedDatasetField, "label" | "type" | "modelingRole" | "eligibleForFilter" | "eligibleForSegment" | "eligibleForBanner">>
): DashboardWorkspace {
  return {
    ...workspace,
    importedDatasets: workspace.importedDatasets.map((dataset) =>
      dataset.id === datasetId
        ? {
            ...dataset,
            fields: dataset.fields.map((field, index) =>
              field.id === fieldId ? normalizeImportedDatasetField({ ...field, ...updates }, index) : field
            )
          }
        : dataset
    )
  };
}

export function findReport(workspace: DashboardWorkspace, reportId: string | null | undefined) {
  return workspace.reports.find((report) => report.id === reportId) ?? null;
}

export function findPublishedSnapshot(
  workspace: DashboardWorkspace,
  reportId: string | null | undefined,
  snapshotId: string | null | undefined
) {
  const reportSnapshots = workspace.publishedSnapshots
    .filter((snapshot) => snapshot.reportId === reportId)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  if (snapshotId) return reportSnapshots.find((snapshot) => snapshot.id === snapshotId) ?? null;
  return reportSnapshots[0] ?? null;
}

export function upsertDraftReport(workspace: DashboardWorkspace, dashboard: DashboardDraft, reportId = dashboard.id): DashboardWorkspace {
  const timestamp = nowIso();
  const normalizedDashboard = normalizeDashboard({ ...dashboard, id: reportId });
  const reports = workspace.reports.map((report) =>
    report.id === reportId
      ? {
          ...report,
          title: normalizedDashboard.title,
          draft: normalizedDashboard,
          updatedAt: timestamp
        }
      : report
  );

  if (!reports.some((report) => report.id === reportId)) {
    reports.push(createReportRecord(normalizedDashboard, timestamp));
  }

  return {
    ...workspace,
    activeReportId: reportId,
    reports
  };
}

export function markReportOpened(workspace: DashboardWorkspace, reportId: string): DashboardWorkspace {
  const timestamp = nowIso();
  return {
    ...workspace,
    activeReportId: reportId,
    reports: workspace.reports.map((report) =>
      report.id === reportId
        ? { ...report, lastOpenedAt: timestamp }
        : report
    )
  };
}

export function createNewReportFromSeed(workspace: DashboardWorkspace): { workspace: DashboardWorkspace; report: DashboardReportRecord } {
  const timestamp = nowIso();
  const id = makeId("report");
  const draft = normalizeDashboard({
    ...cloneDashboard(initialDashboard),
    id,
    title: `Untitled Insight Report ${workspace.reports.length + 1}`,
    status: "draft",
    publishMetadata: {
      publishCount: 0,
      versionLabel: "Draft"
    }
  });
  const report = createReportRecord(draft, timestamp);

  return {
    report,
    workspace: {
      ...workspace,
      activeReportId: report.id,
      reports: [report, ...workspace.reports]
    }
  };
}

export function duplicateReportRecord(workspace: DashboardWorkspace, sourceReport: DashboardReportRecord): { workspace: DashboardWorkspace; report: DashboardReportRecord } {
  const timestamp = nowIso();
  const id = makeId("report");
  const draft = normalizeDashboard({
    ...cloneDashboard(sourceReport.draft),
    id,
    title: `${sourceReport.title} copy`,
    status: "draft",
    publishMetadata: {
      publishCount: 0,
      versionLabel: "Draft"
    }
  });
  const report = createReportRecord(draft, timestamp);

  return {
    report,
    workspace: {
      ...workspace,
      activeReportId: report.id,
      reports: [report, ...workspace.reports]
    }
  };
}

export function createPublishedSnapshot(
  workspace: DashboardWorkspace,
  dashboard: DashboardDraft
): { workspace: DashboardWorkspace; dashboard: DashboardDraft; snapshot: PublishedDashboardSnapshot } {
  const publishedAt = nowIso();
  const publishCount = dashboard.publishMetadata.publishCount + 1;
  const versionLabel = `v${publishCount}`;
  const snapshotId = makeId("snapshot");
  const viewerPath = makePublishedViewerPath(dashboard.id, snapshotId);
  const publishedDashboard = normalizeDashboard({
    ...cloneDashboard(dashboard),
    status: "published",
    publishMetadata: {
      ...dashboard.publishMetadata,
      publishedAt,
      publishCount,
      versionLabel,
      publishedSnapshotId: snapshotId,
      viewerPath
    }
  });
  const snapshot: PublishedDashboardSnapshot = {
    id: snapshotId,
    reportId: dashboard.id,
    title: publishedDashboard.title,
    versionLabel,
    publishedAt,
    viewerPath,
    dashboard: publishedDashboard
  };
  const snapshots = [
    snapshot,
    ...workspace.publishedSnapshots.filter((item) => item.id !== snapshotId)
  ];

  return {
    dashboard: publishedDashboard,
    snapshot,
    workspace: upsertDraftReport({ ...workspace, publishedSnapshots: snapshots }, publishedDashboard, dashboard.id)
  };
}
